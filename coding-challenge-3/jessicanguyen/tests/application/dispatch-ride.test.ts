import { describe, expect, it } from "vitest";
import { CreateRideOfferService } from "../../src/application/dispatch/create-ride-offer.js";
import { ExpireRideOfferService } from "../../src/application/dispatch/expire-ride-offer.js";
import { DispatchRideService } from "../../src/application/dispatch/dispatch-ride.js";
import { MatchDriverService } from "../../src/application/dispatch/match-driver.js";
import { RespondToRideOfferService } from "../../src/application/dispatch/respond-to-ride-offer.js";
import { Driver } from "../../src/domain/driver.js";
import { Location } from "../../src/domain/shared/location.js";
import { Ride } from "../../src/domain/ride.js";
import { RideOffer } from "../../src/domain/ride-offer.js";
import { InMemoryDriverRepository } from "../../src/infrastructure/persistence/in-memory-driver-repository.js";
import { InMemoryRideOfferRepository } from "../../src/infrastructure/persistence/in-memory-ride-offer-repository.js";
import { InMemoryRideRepository } from "../../src/infrastructure/persistence/in-memory-ride-repository.js";

function setup() {
    const rideRepository = new InMemoryRideRepository();
    const driverRepository = new InMemoryDriverRepository();
    const rideOfferRepository = new InMemoryRideOfferRepository();
    const ride = new Ride(
        "R001",
        "P001",
        new Location(10.7769, 106.7009),
        new Location(10.8231, 106.6297)
    );
    rideRepository.save(ride);

    const matchDriverService = new MatchDriverService(driverRepository);
    const createRideOfferService = new CreateRideOfferService(
        rideRepository,
        driverRepository,
        rideOfferRepository
    );
    const expireRideOfferService = new ExpireRideOfferService(
        rideRepository,
        driverRepository,
        rideOfferRepository
    );
    const service = new DispatchRideService(
        rideRepository,
        rideOfferRepository,
        matchDriverService,
        createRideOfferService,
        expireRideOfferService
    );
    const respondToRideOfferService = new RespondToRideOfferService(
        rideRepository,
        driverRepository,
        rideOfferRepository,
        service,
        expireRideOfferService
    );

    return {
        service,
        respondToRideOfferService,
        ride,
        rideRepository,
        driverRepository,
        rideOfferRepository,
        expireRideOfferService,
        createRideOfferService
    };
}

function availableDriver(id: string, latitude: number, longitude: number) {
    return new Driver(id, new Location(latitude, longitude), "AVAILABLE");
}

describe("DispatchRideService", () => {
    it("moves a requested ride to matching and offers the nearest eligible driver", () => {
        const context = setup();
        const farther = availableDriver("D001", 10.78, 106.705);
        const nearest = availableDriver("D002", 10.777, 106.701);
        context.driverRepository.save(farther);
        context.driverRepository.save(nearest);

        const offer = context.service.execute("R001");

        expect(offer).toBeInstanceOf(RideOffer);
        expect(offer?.driverId).toBe("D002");
        expect(context.ride.status).toBe("DRIVER_ASSIGNED");
        expect(context.ride.assignedDriverId).toBe("D002");
        expect(nearest.status).toBe("OFFERED");
    });

    it("leaves a ride matching when no driver is eligible", () => {
        const context = setup();

        expect(context.service.execute("R001")).toBeNull();
        expect(context.ride.status).toBe("MATCHING");
        expect(context.ride.assignedDriverId).toBeNull();
    });

    it("excludes drivers who already received an offer for this ride", () => {
        const context = setup();
        const previouslyOffered = availableDriver("D001", 10.777, 106.701);
        const nextDriver = availableDriver("D002", 10.78, 106.705);
        context.driverRepository.save(previouslyOffered);
        context.driverRepository.save(nextDriver);
        context.ride.status = "MATCHING";
        context.rideOfferRepository.save(new RideOffer(
            "O001",
            "R001",
            "D001",
            new Date(),
            new Date(Date.now() + 30_000),
            "REJECTED"
        ));

        const offer = context.service.execute("R001");

        expect(offer?.driverId).toBe("D002");
        expect(previouslyOffered.status).toBe("AVAILABLE");
        expect(nextDriver.status).toBe("OFFERED");
    });

    it("returns an existing pending offer when dispatch is repeated", () => {
        const context = setup();
        context.driverRepository.save(availableDriver("D001", 10.777, 106.701));

        const firstOffer = context.service.execute("R001");
        const secondOffer = context.service.execute("R001");

        expect(secondOffer).toBe(firstOffer);
        expect(context.rideOfferRepository.findByRideId("R001")).toHaveLength(1);
    });

    it("rejects dispatch for an unknown ride", () => {
        const context = setup();

        expect(() => context.service.execute("unknown")).toThrow("Ride does not exist");
    });

    it("automatically offers the next driver after the current driver rejects", () => {
        const context = setup();
        const firstDriver = availableDriver("D001", 10.777, 106.701);
        const secondDriver = availableDriver("D002", 10.78, 106.705);
        context.driverRepository.save(firstDriver);
        context.driverRepository.save(secondDriver);

        const firstOffer = context.service.execute("R001");
        expect(firstOffer?.driverId).toBe("D001");

        const rejected = context.respondToRideOfferService.reject(
            "R001",
            firstOffer!.id,
            "D001"
        );

        expect(rejected.status).toBe("REJECTED");
        expect(context.ride.status).toBe("DRIVER_ASSIGNED");
        expect(context.ride.assignedDriverId).toBe("D002");
        expect(firstDriver.status).toBe("AVAILABLE");
        expect(secondDriver.status).toBe("OFFERED");
        expect(context.rideOfferRepository.findByRideId("R001")).toHaveLength(2);
    });

    it("keeps the ride in matching when all previously offered drivers are excluded", () => {
        const context = setup();
        const onlyDriver = availableDriver("D001", 10.777, 106.701);
        context.driverRepository.save(onlyDriver);

        const firstOffer = context.service.execute("R001");
        context.respondToRideOfferService.reject("R001", firstOffer!.id, "D001");

        expect(context.ride.status).toBe("MATCHING");
        expect(context.ride.assignedDriverId).toBeNull();
        expect(onlyDriver.status).toBe("AVAILABLE");
        expect(context.rideOfferRepository.findByRideId("R001")).toHaveLength(1);
    });

    it("expires a pending offer, releases its driver, and dispatches the next driver", () => {
        const context = setup();
        const firstDriver = availableDriver("D001", 10.777, 106.701);
        const secondDriver = availableDriver("D002", 10.78, 106.705);
        context.driverRepository.save(firstDriver);
        context.driverRepository.save(secondDriver);

        const firstOffer = context.service.execute("R001");
        const expired = context.expireRideOfferService.execute(
            "R001",
            firstOffer!.id,
            new Date(firstOffer!.expiresAt.getTime())
        );
        expect(expired).toBe(true);

        const nextOffer = context.service.execute("R001");

        expect(firstOffer?.status).toBe("EXPIRED");
        expect(firstDriver.status).toBe("AVAILABLE");
        expect(nextOffer?.driverId).toBe("D002");
        expect(context.ride.status).toBe("DRIVER_ASSIGNED");
    });

    it("does not offer the same driver to two rides dispatched concurrently", async () => {
        const context = setup();
        const driver = availableDriver("D001", 10.777, 106.701);
        context.driverRepository.save(driver);

        const competingRide = new Ride(
            "R002",
            "P001",
            new Location(10.777, 106.701),
            new Location(10.8231, 106.6297)
        );
        context.rideRepository.save(competingRide);

        const staleCandidate = availableDriver("D001", 10.777, 106.701);
        const competingDispatch = new DispatchRideService(
            context.rideRepository,
            context.rideOfferRepository,
            new MatchDriverService({ findAll: () => [staleCandidate] }),
            context.createRideOfferService,
            context.expireRideOfferService
        );

        const results = await Promise.all([
            competingDispatch.execute("R001"),
            competingDispatch.execute("R002")
        ]);
        const rides = [context.ride, competingRide];
        const assignedRides = rides.filter((ride) => ride.assignedDriverId === "D001");

        expect(results.filter(Boolean)).toHaveLength(1);
        expect(assignedRides).toHaveLength(1);
        expect(rides.find((ride) => ride.status === "MATCHING")?.assignedDriverId).toBeNull();
        expect(driver.status).toBe("OFFERED");
        expect(context.rideOfferRepository.findByRideId("R001").length +
            context.rideOfferRepository.findByRideId("R002").length).toBe(1);
    });
});
