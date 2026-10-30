import { Driver } from "../domain/driver.js";
import { Location } from "../domain/shared/location.js";
import type { DriverRepository } from "./ports/driver-repository.js";
import { calculateDistance } from "../domain/shared/distance.js";

const DEFAULT_MAX_RADIUS_KM = 2;

export class MatchDriverService {
    constructor(
        private readonly driverRepository: Pick<DriverRepository, "findAll">,
        private readonly maxRadiusKm = DEFAULT_MAX_RADIUS_KM
    ) {
        if (!Number.isFinite(maxRadiusKm) || maxRadiusKm < 0) {
            throw new Error("Maximum radius must be a non-negative finite number");
        }
    }

    execute(pickup: Location): Driver | null {
        const candidates = this.driverRepository.findAll()
            .flatMap((driver) => {
                if (driver.status !== "AVAILABLE" || driver.location === null) {
                    return [];
                }

                return [{
                    driver,
                    distanceKm: calculateDistance(pickup, driver.location)
                }];
            })
            .filter((candidate) => candidate.distanceKm <= this.maxRadiusKm)
            .sort((a, b) => {
                const distanceDifference = a.distanceKm - b.distanceKm;
                if (distanceDifference !== 0) {
                    return distanceDifference;
                }

                if (a.driver.id < b.driver.id) return -1;
                if (a.driver.id > b.driver.id) return 1;
                return 0;
            });

        return candidates[0]?.driver ?? null;
    }
}