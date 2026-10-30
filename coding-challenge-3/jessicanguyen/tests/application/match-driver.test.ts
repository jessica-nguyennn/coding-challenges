import { describe, expect, it, vi } from "vitest";
import { Driver } from "../../src/domain/driver.js";
import { Location } from "../../src/domain/shared/location.js";
import { MatchDriverService } from "../../src/application/match-driver.js";

function availableDriver(id: string, latitude: number, longitude: number): Driver {
    return new Driver(id, new Location(latitude, longitude), "AVAILABLE");
}

function createService(drivers: Driver[], maxRadiusKm = 2) {
    return new MatchDriverService(
        { findAll: vi.fn().mockReturnValue(drivers) },
        maxRadiusKm
    );
}

describe("MatchDriverService", () => {
    it("selects the nearest available driver within the radius", () => {
        const nearest = availableDriver("D002", 10.777, 106.701);
        const farther = availableDriver("D001", 10.78, 106.705);
        const service = createService([farther, nearest]);

        expect(service.execute(new Location(10.7769, 106.7009))).toBe(nearest);
    });

    it("excludes drivers outside the radius", () => {
        const outsideRadius = availableDriver("D001", 10.9, 106.9);
        const service = createService([outsideRadius]);

        expect(service.execute(new Location(10.7769, 106.7009))).toBeNull();
    });

    it("excludes drivers that are offline or have no known location", () => {
        const offline = new Driver("D001", new Location(10.777, 106.701), "OFFLINE");
        const missingLocation = new Driver("D002", null, "AVAILABLE");
        const service = createService([offline, missingLocation]);

        expect(service.execute(new Location(10.7769, 106.7009))).toBeNull();
    });

    it("breaks equal-distance ties by lexicographically smallest driver id", () => {
        const higherId = availableDriver("D002", 10.777, 106.7009);
        const lowerId = availableDriver("D001", 10.7768, 106.7009);
        const service = createService([higherId, lowerId]);

        expect(service.execute(new Location(10.7769, 106.7009))).toBe(lowerId);
    });
});
