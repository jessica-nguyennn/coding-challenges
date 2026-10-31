import { describe, it, expect, vi } from "vitest";
import { CreateRideService } from "../../src/application/rides/create-ride.js";

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
        }, "request-001");

        expect(ride.id).toBeTruthy();
        expect(ride.passengerId).toBe("P001");
        expect(ride.status).toBe("REQUESTED");
        expect(ride.assignedDriverId).toBeNull();
        expect(rideRepository.save).toHaveBeenCalledWith(ride);
    });

    it("should reject a request from an unknown passenger", () => {
        const passengerRepository = {
            exists: vi.fn().mockReturnValue(false)
        };

        const rideRepository = {
            save: vi.fn()
        };

        const service = new CreateRideService(
            passengerRepository,
            rideRepository
        );

        const request = {
            passengerId: "P999",
            pickup: {
                latitude: 10.7769,
                longitude: 106.7009
            },
            destination: {
                latitude: 10.8231,
                longitude: 106.6297
            }
        };

        expect(() => service.execute(request, "request-001")).toThrow(
            "Passenger does not exist"
        );

        expect(rideRepository.save).not.toHaveBeenCalled();
    });

    it("should return the original ride when the same request is repeated", () => {
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

        const request = {
            passengerId: "P001",
            pickup: {
                latitude: 10.7769,
                longitude: 106.7009
            },
            destination: {
                latitude: 10.8231,
                longitude: 106.6297
            }
        };

        const firstRide = service.execute(request, "request-001");
        const secondRide = service.execute(request, "request-001");

        expect(secondRide).toBe(firstRide);
        expect(rideRepository.save).toHaveBeenCalledTimes(1);
    });

    it("should reject a different request with the same idempotency key", () => {
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

        const firstRequest = {
            passengerId: "P001",
            pickup: {
                latitude: 10.7769,
                longitude: 106.7009
            },
            destination: {
                latitude: 10.8231,
                longitude: 106.6297
            }
        };

        const differentRequest = {
            ...firstRequest,
            destination: {
                latitude: 10.7626,
                longitude: 106.6602
            }
        };

        service.execute(firstRequest, "request-001");

        expect(() => {
            service.execute(differentRequest, "request-001");
        }).toThrow("Idempotency key already used with a different request");

        expect(rideRepository.save).toHaveBeenCalledTimes(1);
    });
});