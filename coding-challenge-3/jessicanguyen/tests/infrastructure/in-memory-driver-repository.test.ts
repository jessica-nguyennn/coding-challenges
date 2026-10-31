import { describe, expect, it } from "vitest";
import { InMemoryDriverRepository } from "../../src/infrastructure/persistence/in-memory-driver-repository.js";
import { Location } from "../../src/domain/shared/location.js";
import { Driver } from "../../src/domain/driver.js";

describe("InMemoryDriverRepository.claimForOffer", () => {
    it("allows only one claim while the driver is available", () => {
        const repository = new InMemoryDriverRepository();
        repository.save(new Driver(
            "D100",
            new Location(10.777, 106.701),
            "AVAILABLE"
        ));

        const claims = [
            repository.claimForOffer("D100"),
            repository.claimForOffer("D100")
        ];

        expect(claims.filter(Boolean)).toHaveLength(1);
        expect(repository.findById("D100")?.status).toBe("OFFERED");
    });

    it("returns no claim for unknown or unavailable drivers", () => {
        const repository = new InMemoryDriverRepository();
        repository.save(new Driver("D101", null, "OFFLINE"));

        expect(repository.claimForOffer("missing")).toBeUndefined();
        expect(repository.claimForOffer("D101")).toBeUndefined();
    });
});
