import { describe, it, expect, beforeEach, vi } from "vitest";
import { CancelRideService } from "../../src/application/cancel-ride.js";
import { Ride } from "../../src/domain/ride.js";
import { Location } from "../../src/domain/shared/location.js";
import { Driver } from "../../src/domain/driver.js";
import { RideOffer } from "../../src/domain/ride-offer.js";

describe("CancelRideService", () => {
    let rideRepository: {
        findById: ReturnType<typeof vi.fn<(id: string) => Ride | undefined>>;
        save: ReturnType<typeof vi.fn<(ride: Ride) => void>>;
    };

    let driverRepository: {
        findById: ReturnType<typeof vi.fn<(id: string) => Driver | undefined>>;
        save: ReturnType<typeof vi.fn<(driver: Driver) => void>>;
    };

    let rideOfferRepository: {
        findByRideId: ReturnType<typeof vi.fn<(id: string) => RideOffer[]>>;
        save: ReturnType<typeof vi.fn<(offer: RideOffer) => void>>;
    };

    let cancelRideService: CancelRideService;
    let ride: Ride;

    beforeEach(() => {
        ride = new Ride(
            "R001",
            "P001",
            new Location(10.7769, 106.7009),
            new Location(10.8000, 106.7000)
        );

        ride.status = "MATCHING";

        rideRepository = {
            findById: vi.fn<(id: string) => Ride | undefined>(() => ride),
            save: vi.fn<(ride: Ride) => void>(),
        };

        driverRepository = {
            findById: vi.fn<(id: string) => Driver | undefined>(),
            save: vi.fn<(driver: Driver) => void>(),
        };

        rideOfferRepository = {
            findByRideId: vi.fn<(id: string) => RideOffer[]>(() => []),
            save: vi.fn<(offer: RideOffer) => void>(),
        };

        cancelRideService = new CancelRideService(
            rideRepository,
            driverRepository,
            rideOfferRepository
        );
    });

    it("should cancel a ride that is matching", () => {
        cancelRideService.execute("R001");

        expect(ride.status).toBe("CANCELLED");
        expect(rideRepository.save).toHaveBeenCalledWith(ride);
        expect(driverRepository.findById).not.toHaveBeenCalled();
        expect(rideOfferRepository.findByRideId).not.toHaveBeenCalled();
    });

    // Keep your other existing cancellation tests below this point.
});