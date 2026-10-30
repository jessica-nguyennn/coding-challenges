import { Router } from "express";
import { CreateRideService } from "../application/create-ride.js";

export function createRideRouter(service: CreateRideService) {
    const router = Router();

    router.post("/", (req, res) => {
        const idempotencyKey = req.get("Idempotency-Key");

        if (!idempotencyKey?.trim()) {
            return res.status(400).json({
                error: "Idempotency-Key header is required"
            });
        }

        try {
            const ride = service.execute(req.body, idempotencyKey);
            return res.status(201).json(ride);
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : "Invalid request";

            if (message === "Passenger does not exist") {
                return res.status(404).json({ error: message });
            }

            if (message === "Idempotency key already used with a different request") {
                return res.status(409).json({ error: message });
            }

            return res.status(400).json({ error: message });
        }
    });

    return router;
}