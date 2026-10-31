import { describe, it, expect, beforeEach, vi } from "vitest";
import { CompleteRideService } from "../../src/application/rides/complete-ride.js";
import { Ride } from "../../src/domain/ride.js";
import { Driver } from "../../src/domain/driver.js";
import { Location } from "../../src/domain/shared/location.js";

describe("CompleteRideService", () => {
    let rideRepository: {
        findById: ReturnType<typeof vi.fn<(id: string) => Ride | undefined>>;
        save: ReturnType<typeof vi.fn<(ride: Ride) => void>>;
    };

    let driverRepository: {
        findById: ReturnType<typeof vi.fn<(id: string) => Driver | undefined>>;
        save: ReturnType<typeof vi.fn<(driver: Driver) => void>>;
    };

    let completeRideService: CompleteRideService;
    let ride: Ride;
    let driver: Driver;

    beforeEach(() => {
        ride = new Ride(
            "R001",
            "P001",
            new Location(10.7769, 106.7009),
            new Location(10.8000, 106.7000)
        );
        ride.status = "DRIVER_ACCEPTED";
        ride.assignedDriverId = "D001";

        driver = new Driver(
            "D001",
            new Location(10.7800, 106.7000),
            "BUSY"
        );

        rideRepository = {
            findById: vi.fn<(id: string) => Ride | undefined>(() => ride),
            save: vi.fn<(ride: Ride) => void>(),
        };

        driverRepository = {
            findById: vi.fn<(id: string) => Driver | undefined>(() => driver),
            save: vi.fn<(driver: Driver) => void>(),
        };

        completeRideService = new CompleteRideService(
            rideRepository,
            driverRepository
        );
    });

    it("should complete an accepted ride and release its driver", () => {
        completeRideService.execute("R001");

        expect(ride.status).toBe("COMPLETED");
        expect(driver.status).toBe("AVAILABLE");

        expect(rideRepository.save).toHaveBeenCalledWith(ride);
        expect(driverRepository.save).toHaveBeenCalledWith(driver);
    });

    it("should treat completing the same ride again as a no-op", () => {
        completeRideService.execute("R001");
        rideRepository.save.mockClear();
        driverRepository.save.mockClear();

        expect(() => completeRideService.execute("R001")).not.toThrow();

        expect(ride.status).toBe("COMPLETED");
        expect(driver.status).toBe("AVAILABLE");
        expect(rideRepository.save).not.toHaveBeenCalled();
        expect(driverRepository.save).not.toHaveBeenCalled();
    });
});