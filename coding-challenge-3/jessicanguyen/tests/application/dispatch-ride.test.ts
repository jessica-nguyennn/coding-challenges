import { describe, expect, it } from "vitest";
import { CreateRideOfferService } from "../../src/application/create-ride-offer.js";
import { DispatchRideService } from "../../src/application/dispatch-ride.js";
import { MatchDriverService } from "../../src/application/match-driver.js";
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
    const service = new DispatchRideService(
        rideRepository,
        rideOfferRepository,
        matchDriverService,
        createRideOfferService
    );

    return {
        service,
        ride,
        rideRepository,
        driverRepository,
        rideOfferRepository
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
});
