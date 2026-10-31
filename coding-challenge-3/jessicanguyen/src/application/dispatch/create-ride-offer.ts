import { randomUUID } from "node:crypto";

import type { Ride } from "../../domain/ride.js";
import type { Driver } from "../../domain/driver.js";
import { RideOffer } from "../../domain/ride-offer.js";

import type { RideRepository } from "../ports/ride-repository.js";
import type { DriverRepository } from "../ports/driver-repository.js";
import type { RideOfferRepository } from "../ports/ride-offer-repository.js";

const DEFAULT_RESPONSE_TIMEOUT_MS = 30_000;

export class DriverNotAvailableError extends Error {
    constructor() {
        super("Driver is not available");
        this.name = "DriverNotAvailableError";
    }
}

export class CreateRideOfferService {
    private expirationHandler?: (
        rideId: string,
        offerId: string,
        expiresAt: Date
    ) => void;

    constructor(
        private readonly rideRepository: Pick<
            RideRepository,
            "findById" | "save"
        >,
        private readonly driverRepository: Pick<
            DriverRepository,
            "findById" | "claimForOffer"
        >,
        private readonly rideOfferRepository: RideOfferRepository,
        private readonly responseTimeoutMs = DEFAULT_RESPONSE_TIMEOUT_MS
    ) {
        if (
            !Number.isFinite(responseTimeoutMs) ||
            responseTimeoutMs <= 0
        ) {
            throw new Error("Response timeout must be a positive finite number");
        }
    }

    setExpirationHandler(
        handler: (rideId: string, offerId: string, expiresAt: Date) => void
    ): void {
        this.expirationHandler = handler;
    }

    execute(rideId: string, driverId: string): RideOffer {
        const ride = this.rideRepository.findById(rideId);

        if (!ride) {
            throw new Error("Ride does not exist");
        }

        const driver = this.driverRepository.findById(driverId);

        if (!driver) {
            throw new Error("Driver does not exist");
        }

        if (ride.status !== "MATCHING") {
            throw new Error("Ride is not matching");
        }

        const createdAt = new Date();

        const offer = new RideOffer(
            randomUUID(),
            rideId,
            driverId,
            createdAt,
            new Date(createdAt.getTime() + this.responseTimeoutMs)
        );

        if (!this.driverRepository.claimForOffer(driverId)) {
            throw new DriverNotAvailableError();
        }

        ride.transitionTo("DRIVER_ASSIGNED");
        ride.assignedDriverId = driverId;
        this.rideRepository.save(ride);
        this.rideOfferRepository.save(offer);
        this.expirationHandler?.(rideId, offer.id, offer.expiresAt);

        return offer;
    }
}