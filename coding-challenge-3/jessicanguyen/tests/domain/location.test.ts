import { describe, it, expect } from "vitest";
import { Location } from "../../src/domain/shared/location.js";

describe("Location", () => {
    it("should create a location with valid coordinates", () => {
        const location = new Location(10.7769, 106.7009);

        expect(location.latitude).toBe(10.7769);
        expect(location.longitude).toBe(106.7009);
    });

    it("should accept the minimum and maximum latitude", () => {
        expect(() => new Location(-90, 0)).not.toThrow();
        expect(() => new Location(90, 0)).not.toThrow();
    });

    it("should accept the minimum and maximum longitude", () => {
        expect(() => new Location(0, -180)).not.toThrow();
        expect(() => new Location(0, 180)).not.toThrow();
    });

    it("should reject latitude greater than 90", () => {
        expect(() => new Location(91, 0)).toThrow();
    });

    it("should reject latitude less than -90", () => {
        expect(() => new Location(-91, 0)).toThrow();
    });

    it("should reject longitude greater than 180", () => {
        expect(() => new Location(0, 181)).toThrow();
    });

    it("should reject longitude less than -180", () => {
        expect(() => new Location(0, -181)).toThrow();
    });

    it("should reject non-finite coordinates", () => {
        expect(() => new Location(NaN, 0)).toThrow();
        expect(() => new Location(0, Infinity)).toThrow();
    });
});