import { Location } from "../../domain/shared/location.js";
import type { DriverRepository } from "../ports/driver-repository.js";

export class UpdateDriverLocationService {
    constructor(private driverRepository: DriverRepository) {}

    execute(driverId: string, latitude: number, longitude: number) {
        const driver = this.driverRepository.findById(driverId);
        if (!driver) {
            throw new Error("Driver does not exist");
        }

        driver.location = new Location(latitude, longitude);
        this.driverRepository.save(driver);
        return driver;
    }
}
