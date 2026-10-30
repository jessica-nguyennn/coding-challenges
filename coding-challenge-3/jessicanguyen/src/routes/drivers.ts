import { Router } from "express";
import type { DriverRepository } from "../application/ports/driver-repository.js";
import { UpdateDriverLocationService } from "../application/update-driver-location.js";
import { UpdateDriverAvailabilityService } from "../application/update-driver-availability.js";

export function createDriverRouter(
    availabilityService: UpdateDriverAvailabilityService,
    locationService: UpdateDriverLocationService,
    driverRepository: Pick<DriverRepository, "findAll">
) {
    const router = Router();

    router.get("/", (_req, res) => {
        const drivers = driverRepository.findAll().map((driver) => ({
            id: driver.id,
            status: driver.status,
            location: driver.location
        }));
        return res.status(200).json(drivers);
    });

    router.put("/:driverId/availability", (req, res) => {
        const status = req.body?.status;
        if (status !== "OFFLINE" && status !== "AVAILABLE") {
            return res.status(400).json({
                error: "Status must be OFFLINE or AVAILABLE"
            });
        }

        try {
            const driver = availabilityService.execute(req.params.driverId, status);
            return res.status(200).json({
                id: driver.id,
                status: driver.status,
                location: driver.location
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid request";

            if (message === "Driver does not exist") {
                return res.status(404).json({ error: message });
            }

            return res.status(409).json({ error: message });
        }
    });

    router.put("/:driverId/location", (req, res) => {
        const { latitude, longitude } = req.body ?? {};

        try {
            const driver = locationService.execute(
                req.params.driverId,
                latitude,
                longitude
            );
            return res.status(200).json({
                id: driver.id,
                status: driver.status,
                location: driver.location
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid request";

            if (message === "Driver does not exist") {
                return res.status(404).json({ error: message });
            }

            return res.status(400).json({ error: message });
        }
    });

    return router;
}
