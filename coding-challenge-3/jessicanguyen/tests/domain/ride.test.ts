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
});