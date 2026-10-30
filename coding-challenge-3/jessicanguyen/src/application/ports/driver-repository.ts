import type { Driver } from "../../domain/driver.js";

export interface DriverRepository {
    findById(driverId: string): Driver | undefined;
    save(driver: Driver): void;
}
