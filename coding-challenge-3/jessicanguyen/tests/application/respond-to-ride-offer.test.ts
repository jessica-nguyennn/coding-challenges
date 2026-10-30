import { describe, it, expect, beforeEach, vi } from "vitest";
import { Ride } from "../../src/domain/ride.js";
import { Driver } from "../../src/domain/driver.js";
import { RideOffer } from "../../src/domain/ride-offer.js";
import { Location } from "../../src/domain/shared/location.js";
import { RespondToRideOfferService } from "../../src/application/respond-to-ride-offer.js";

describe("RespondToRideOfferService", () => {
    let ride: Ride;
    let driver: Driver;
    let offer: RideOffer;

    let rideRepository: {
        findById: ReturnType<typeof vi.fn<(rideId: string) => Ride | undefined>>;
        save: ReturnType<typeof vi.fn<(ride: Ride) => void>>;
    };

    let driverRepository: {
        findById: ReturnType<typeof vi.fn<(driverId: string) => Driver | undefined>>;
        save: ReturnType<typeof vi.fn<(driver: Driver) => void>>;
    };

    let rideOfferRepository: {
        findById: ReturnType<typeof vi.fn<(offerId: string) => RideOffer | undefined>>;
        save: ReturnType<typeof vi.fn<(offer: RideOffer) => void>>;
    };

    beforeEach(() => {
        ride = new Ride(
            "R001",
            "P001",
            new Location(10.7769, 106.7009),
            new Location(10.8231, 106.6297)
        );
        ride.status = "DRIVER_ASSIGNED";
        ride.assignedDriverId = "D001";

        driver = new Driver(
            "D001",
            new Location(10.7800, 106.7010),
            "OFFERED"
        );

        const now = new Date();

        offer = new RideOffer(
            "O001",
            "R001",
            "D001",
            now,
            new Date(now.getTime() + 30_000)
        );

        rideRepository = {
            findById: vi.fn<(rideId: string) => Ride | undefined>()
                .mockReturnValue(ride),
            save: vi.fn<(ride: Ride) => void>()
        };

        driverRepository = {
            findById: vi.fn<(driverId: string) => Driver | undefined>()
                .mockReturnValue(driver),
            save: vi.fn<(driver: Driver) => void>()
        };

        rideOfferRepository = {
            findById: vi.fn<(offerId: string) => RideOffer | undefined>()
                .mockReturnValue(offer),
            save: vi.fn<(offer: RideOffer) => void>()
        };
    });

    it("should accept a pending offer and assign the driver to the ride", () => {
        const service = new RespondToRideOfferService(
            rideRepository,
            driverRepository,
            rideOfferRepository
        );

        service.accept("R001", "O001", "D001");

        expect(offer.status).toBe("ACCEPTED");
        expect(ride.status).toBe("DRIVER_ACCEPTED");
        expect(ride.assignedDriverId).toBe("D001");
        expect(driver.status).toBe("BUSY");

        expect(rideRepository.save).toHaveBeenCalledWith(ride);
        expect(driverRepository.save).toHaveBeenCalledWith(driver);
        expect(rideOfferRepository.save).toHaveBeenCalledWith(offer);
    });

    it("should reject acceptance from a different driver", () => {
        const service = new RespondToRideOfferService(
            rideRepository,
            driverRepository,
            rideOfferRepository
        );

        expect(() => service.accept("R001", "O001", "D002"))
            .toThrow("Driver is not authorized to accept this offer");

        expect(offer.status).toBe("PENDING");
        expect(ride.status).toBe("DRIVER_ASSIGNED");
        expect(driver.status).toBe("OFFERED");

        expect(rideRepository.save).not.toHaveBeenCalled();
        expect(driverRepository.save).not.toHaveBeenCalled();
        expect(rideOfferRepository.save).not.toHaveBeenCalled();
    });

    it("should reject a pending offer and release the driver", () => {
        const service = new RespondToRideOfferService(
            rideRepository,
            driverRepository,
            rideOfferRepository
        );

        service.reject("R001", "O001", "D001");

        expect(offer.status).toBe("REJECTED");
        expect(ride.status).toBe("MATCHING");
        expect(ride.assignedDriverId).toBeNull();
        expect(driver.status).toBe("AVAILABLE");

        expect(rideOfferRepository.save).toHaveBeenCalledWith(offer);
        expect(rideRepository.save).toHaveBeenCalledWith(ride);
        expect(driverRepository.save).toHaveBeenCalledWith(driver);
    });
});