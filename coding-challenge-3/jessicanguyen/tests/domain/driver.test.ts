import { describe, expect, it } from "vitest";
import { Driver } from "../../src/domain/driver.js";
import { Location } from "../../src/domain/shared/location.js";

describe("Driver availability", () => {
    it("starts without a known location and stores an updated location", () => {
        const driver = new Driver("D001");
        const location = new Location(10.7769, 106.7009);

        expect(driver.location).toBeNull();

        driver.location = location;

        expect(driver.location).toBe(location);
    });

    it("allows switching between OFFLINE and AVAILABLE", () => {
        const driver = new Driver("D001");

        driver.setAvailability("AVAILABLE");
        expect(driver.status).toBe("AVAILABLE");

        driver.setAvailability("OFFLINE");
        expect(driver.status).toBe("OFFLINE");
    });

    it.each(["OFFERED", "BUSY"] as const)(
        "rejects availability changes while %s",
        (status) => {
            const driver = new Driver("D001", null, status);

            expect(() => driver.setAvailability("OFFLINE")).toThrow(
                `Driver cannot change availability while ${status}`
            );
            expect(() => driver.setAvailability("AVAILABLE")).toThrow(
                `Driver cannot change availability while ${status}`
            );
            expect(driver.status).toBe(status);
        }
    );

    it("should transition from OFFERED to BUSY when accepting a ride", () => {
        const driver = new Driver("D001", null, "OFFERED");

        driver.acceptRide();

        expect(driver.status).toBe("BUSY");
    });

    it("should not accept a ride when the driver has no pending offer", () => {
        const driver = new Driver("D001", null, "AVAILABLE");

        expect(() => driver.acceptRide())
            .toThrow("Only drivers with a pending offer can accept");

        expect(driver.status).toBe("AVAILABLE");
    });
});
