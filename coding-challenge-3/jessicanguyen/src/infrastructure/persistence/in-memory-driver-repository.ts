import type { DriverRepository } from "../../application/ports/driver-repository.js";
import { Driver } from "../../domain/driver.js";
import { Location } from "../../domain/shared/location.js";

export class InMemoryDriverRepository implements DriverRepository {
    private drivers = new Map<string, Driver>([
        ["D001", new Driver("D001", new Location(10.778, 106.701))],
        ["D002", new Driver("D002", new Location(10.783, 106.704))],
        ["D003", new Driver("D003", new Location(10.785, 106.699))]
    ]);

    findById(driverId: string): Driver | undefined {
        return this.drivers.get(driverId);
    }

    findAll(): Driver[] {
        return [...this.drivers.values()];
    }

    save(driver: Driver): void {
        this.drivers.set(driver.id, driver);
    }
}
