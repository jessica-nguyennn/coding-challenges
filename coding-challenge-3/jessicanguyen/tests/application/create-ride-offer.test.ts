import { describe, it, expect, beforeEach, vi } from "vitest";
import { Ride } from "../../src/domain/ride.js";
import { Driver } from "../../src/domain/driver.js";
import { Location } from "../../src/domain/shared/location.js";
import { CreateRideOfferService } from "../../src/application/dispatch/create-ride-offer.js";
import { RideOffer } from "../../src/domain/ride-offer.js";

describe("CreateRideOfferService", () => {
    let ride: Ride;
    let driver: Driver;

    let rideRepository: {
        findById: ReturnType<typeof vi.fn<(rideId: string) => Ride | undefined>>;
        save: ReturnType<typeof vi.fn<(ride: Ride) => void>>;
    };

    let driverRepository: {
        findById: ReturnType<typeof vi.fn<(driverId: string) => Driver | undefined>>;
        save: ReturnType<typeof vi.fn<(driver: Driver) => void>>;
        claimForOffer: ReturnType<typeof vi.fn<() => Driver | undefined>>;
    };

    let rideOfferRepository: {
        findById: ReturnType<typeof vi.fn<(offerId: string) => RideOffer | undefined>>;
        findByRideId: ReturnType<typeof vi.fn<(rideId: string) => RideOffer[]>>;
        save: ReturnType<typeof vi.fn<(offer: RideOffer) => void>>;
    };
    beforeEach(() => {
        ride = new Ride(
            "R001",
            "P001",
            new Location(10.7769, 106.7009),
            new Location(10.8231, 106.6297)
        );

        ride.status = "MATCHING";

        driver = new Driver(
            "D001",
            new Location(10.7800, 106.7010),
            "AVAILABLE"
        );

        rideRepository = {
            findById: vi.fn<(rideId: string) => Ride | undefined>()
                .mockReturnValue(ride),
            save: vi.fn<(ride: Ride) => void>()
        };

        driverRepository = {
            findById: vi.fn<(driverId: string) => Driver | undefined>()
                .mockReturnValue(driver),
            save: vi.fn<(driver: Driver) => void>(),
            claimForOffer: vi.fn(() => {
                if (driver.status !== "AVAILABLE") {
                    return undefined;
                }
                driver.offerRide();
                return driver;
            })
        };

        rideOfferRepository = {
            findById: vi.fn<(offerId: string) => RideOffer | undefined>(),
            findByRideId: vi.fn<(rideId: string) => RideOffer[]>(),
            save: vi.fn<(offer: RideOffer) => void>()
        };
    });

    it("should create a pending offer and assign the driver to the ride", () => {
        const service = new CreateRideOfferService(
            rideRepository,
            driverRepository,
            rideOfferRepository
        );

        const offer = service.execute("R001", "D001");

        expect(offer.status).toBe("PENDING");
        expect(ride.status).toBe("DRIVER_ASSIGNED");
        expect(ride.assignedDriverId).toBe("D001");
        expect(driver.status).toBe("OFFERED");
        expect(rideRepository.save).toHaveBeenCalledWith(ride);
        expect(driverRepository.claimForOffer).toHaveBeenCalledWith("D001");
        expect(rideOfferRepository.save).toHaveBeenCalledWith(offer);
    });

    it("should reject an offer when the driver is not available", () => {
        driver.setAvailability("OFFLINE");

        const service = new CreateRideOfferService(
            rideRepository,
            driverRepository,
            rideOfferRepository
        );

        expect(() => service.execute("R001", "D001"))
            .toThrow("Driver is not available");

        expect(ride.status).toBe("MATCHING");
        expect(ride.assignedDriverId).toBeNull();
        expect(driver.status).toBe("OFFLINE");

        expect(rideRepository.save).not.toHaveBeenCalled();
        expect(driverRepository.save).not.toHaveBeenCalled();
        expect(driverRepository.claimForOffer).toHaveBeenCalledWith("D001");
        expect(rideOfferRepository.save).not.toHaveBeenCalled();
    });

    it("should reject an offer when the ride is not matching", () => {
        ride.status = "DRIVER_ASSIGNED";
        ride.assignedDriverId = "D002";

        const service = new CreateRideOfferService(
            rideRepository,
            driverRepository,
            rideOfferRepository
        );

        expect(() => service.execute("R001", "D001"))
            .toThrow("Ride is not matching");

        expect(driver.status).toBe("AVAILABLE");
        expect(ride.assignedDriverId).toBe("D002");

        expect(rideRepository.save).not.toHaveBeenCalled();
        expect(driverRepository.save).not.toHaveBeenCalled();
        expect(rideOfferRepository.save).not.toHaveBeenCalled();
    });
});