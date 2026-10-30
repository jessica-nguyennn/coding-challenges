import { Router } from "express";
import { UpdateDriverAvailabilityService } from "../application/update-driver-availability.js";

export function createDriverRouter(service: UpdateDriverAvailabilityService) {
    const router = Router();

    router.put("/:driverId/availability", (req, res) => {
        const status = req.body?.status;
        if (status !== "OFFLINE" && status !== "AVAILABLE") {
            return res.status(400).json({
                error: "Status must be OFFLINE or AVAILABLE"
            });
        }

        try {
            const driver = service.execute(req.params.driverId, status);
            return res.status(200).json({
                id: driver.id,
                status: driver.status,
                latitude: driver.latitude,
                longitude: driver.longitude
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid request";

            if (message === "Driver does not exist") {
                return res.status(404).json({ error: message });
            }

            return res.status(409).json({ error: message });
        }
    });

    return router;
}
