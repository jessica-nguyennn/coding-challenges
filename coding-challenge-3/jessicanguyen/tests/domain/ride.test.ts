import { describe, it, expect } from "vitest";
import { Ride } from "../../src/domain/ride.js";
import { Location } from "../../src/domain/shared/location.js";

describe("Ride", () => {
    it("should create a ride with valid locations", () => {
        const startLocation = new Location(10.7769, 106.7009);
        const endLocation = new Location(10.7626, 106.6602);
        const ride = new Ride(
            "ride-001",
            "P001",
            startLocation,
            endLocation
        );

        expect(ride.status).toBe("REQUESTED");
        expect(ride.assignedDriverId).toBeNull();

    });

    it("allows valid transitions and treats a repeated transition as a no-op", () => {
        const ride = new Ride(
            "ride-002",
            "P001",
            new Location(10.7769, 106.7009),
            new Location(10.7626, 106.6602)
        );

        expect(ride.transitionTo("MATCHING")).toBe(true);
        expect(ride.transitionTo("MATCHING")).toBe(false);
        expect(ride.status).toBe("MATCHING");
    });

    it("rejects conflicting transitions without changing state", () => {
        const ride = new Ride(
            "ride-003",
            "P001",
            new Location(10.7769, 106.7009),
            new Location(10.7626, 106.6602)
        );

        expect(() => ride.transitionTo("COMPLETED"))
            .toThrow("Invalid ride status transition: REQUESTED -> COMPLETED");
        expect(ride.status).toBe("REQUESTED");
    });
});