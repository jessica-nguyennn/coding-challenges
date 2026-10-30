import { Router } from "express";
import { CreateRideService } from "../application/create-ride.js";
import { CreateRideOfferService } from "../application/create-ride-offer.js";
import { RespondToRideOfferService } from "../application/respond-to-ride-offer.js";

function errorResponse(error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid request";

    if (
        message === "Ride does not exist" ||
        message === "Driver does not exist" ||
        message === "Ride offer does not exist"
    ) {
        return { status: 404, body: { error: message } };
    }

    if (message.includes("not authorized")) {
        return { status: 403, body: { error: message } };
    }

    return { status: 409, body: { error: message } };
}

export function createRideRouter(
    service: CreateRideService,
    createRideOfferService: CreateRideOfferService,
    respondToRideOfferService: RespondToRideOfferService
) {
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

    router.post("/:rideId/offers", (req, res) => {
        const { driverId } = req.body ?? {};
        if (typeof driverId !== "string" || !driverId.trim()) {
            return res.status(400).json({ error: "driverId is required" });
        }

        try {
            const offer = createRideOfferService.execute(req.params.rideId, driverId);
            return res.status(201).json(offer);
        } catch (error) {
            const response = errorResponse(error);
            return res.status(response.status).json(response.body);
        }
    });

    for (const action of ["accept", "reject"] as const) {
        router.post("/:rideId/offers/:offerId/" + action, (req, res) => {
            const { rideId, offerId } = req.params;
            if (typeof rideId !== "string" || typeof offerId !== "string") {
                return res.status(400).json({ error: "Invalid ride offer path" });
            }

            const { driverId } = req.body ?? {};
            if (typeof driverId !== "string" || !driverId.trim()) {
                return res.status(400).json({ error: "driverId is required" });
            }

            try {
                const offer = action === "accept"
                    ? respondToRideOfferService.accept(
                        rideId,
                        offerId,
                        driverId
                    )
                    : respondToRideOfferService.reject(
                        rideId,
                        offerId,
                        driverId
                    );
                return res.status(200).json(offer);
            } catch (error) {
                const response = errorResponse(error);
                return res.status(response.status).json(response.body);
            }
        });
    }

    return router;
}