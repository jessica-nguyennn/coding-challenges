import type { DriverAvailability } from "../../domain/driver.js";
import type { DriverRepository } from "../ports/driver-repository.js";

export class UpdateDriverAvailabilityService {
    constructor(private driverRepository: DriverRepository) {}

    execute(driverId: string, status: DriverAvailability) {
        const driver = this.driverRepository.findById(driverId);
        if (!driver) {
            throw new Error("Driver does not exist");
        }

        driver.setAvailability(status);
        this.driverRepository.save(driver);
        return driver;
    }
}
