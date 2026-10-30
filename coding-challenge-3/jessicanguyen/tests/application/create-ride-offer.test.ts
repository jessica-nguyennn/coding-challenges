import { describe, it, expect, beforeEach, vi } from "vitest";
import { Ride } from "../../src/domain/ride.js";
import { Driver } from "../../src/domain/driver.js";
import { Location } from "../../src/domain/shared/location.js";
import { CreateRideOfferService } from "../../src/application/create-ride-offer.js";
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
    };

    let rideOfferRepository: {
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
            save: vi.fn<(driver: Driver) => void>()
        };

        rideOfferRepository = {
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
        expect(driverRepository.save).toHaveBeenCalledWith(driver);
        expect(rideOfferRepository.save).toHaveBeenCalledWith(offer);
    });
});