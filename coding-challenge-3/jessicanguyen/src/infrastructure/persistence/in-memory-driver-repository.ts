import type { DriverRepository } from "../../application/ports/driver-repository.js";
import { Driver } from "../../domain/driver.js";

export class InMemoryDriverRepository implements DriverRepository {
    private drivers = new Map<string, Driver>([
        ["D001", new Driver("D001")]
    ]);

    findById(driverId: string): Driver | undefined {
        return this.drivers.get(driverId);
    }

    save(driver: Driver): void {
        this.drivers.set(driver.id, driver);
    }
}
