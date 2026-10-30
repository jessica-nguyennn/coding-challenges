import { describe, expect, it } from "vitest";
import { Driver } from "../../src/domain/driver.js";

describe("Driver availability", () => {
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
            const driver = new Driver("D001", status);

            expect(() => driver.setAvailability("OFFLINE")).toThrow(
                `Driver cannot change availability while ${status}`
            );
            expect(() => driver.setAvailability("AVAILABLE")).toThrow(
                `Driver cannot change availability while ${status}`
            );
            expect(driver.status).toBe(status);
        }
    );
});
