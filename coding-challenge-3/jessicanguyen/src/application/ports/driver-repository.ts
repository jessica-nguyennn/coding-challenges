import type { Driver } from "../../domain/driver.js";

export interface DriverRepository {
    findById(driverId: string): Driver | undefined;
    findAll(): Driver[];
    save(driver: Driver): void;
}
