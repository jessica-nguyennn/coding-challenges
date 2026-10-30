import { Router } from "express";
import { CreateRideService } from "../application/create-ride.js";

export function createRideRouter(service: CreateRideService) {
    const router = Router();

    router.post("/", (req, res) => {
        const idempotencyKey = req.get("Idempotency-Key");

        const ride = service.execute(req.body, idempotencyKey!);

        return res.status(201).json(ride);
    });

    return router;
}