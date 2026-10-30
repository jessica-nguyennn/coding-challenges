import { describe, it, expect, vi } from "vitest";
import { CreateRideService } from "../../src/application/create-ride.js";

describe("CreateRideService", () => {
    it("should create and save a ride for an existing passenger", () => {

        const passengerRepository = {
            exists: vi.fn().mockReturnValue(true)
        };

        const rideRepository = {
            save: vi.fn()
        };

        const service = new CreateRideService(
            passengerRepository,
            rideRepository
        );

        const ride = service.execute({
            passengerId: "P001",
            pickup: {
                latitude: 10.7769,
                longitude: 106.7009
            },
            destination: {
                latitude: 10.8231,
                longitude: 106.6297
            }
        });

        expect(ride.id).toBeTruthy();
        expect(ride.passengerId).toBe("P001");
        expect(ride.status).toBe("REQUESTED");
        expect(ride.assignedDriverId).toBeNull();
        expect(rideRepository.save).toHaveBeenCalledWith(ride);
    });
});