import { randomUUID } from "node:crypto";
import { Ride } from "../../domain/ride.js";
import { Location } from "../../domain/shared/location.js";
import type { PassengerRepository } from "../ports/passenger-repository.js";
import type { RideRepository } from "../ports/ride-repository.js";
import type { EventBus } from "../ports/event-bus.js";
import { workflowLogger, type WorkflowLogger } from "../ports/workflow-logger.js";


interface CreateRideInput {
    passengerId: string;
    pickup: {
        latitude: number;
        longitude: number;
    };
    destination: {
        latitude: number;
        longitude: number;
    };
}

export class CreateRideService {
    private idempotencyRecords = new Map<
        string,
        { fingerprint: string; ride: Ride }
    >();
    constructor(
        private passengerRepository: PassengerRepository,
        private rideRepository: Pick<RideRepository, "save">,
        private eventBus: Pick<EventBus, "publish">,
        private logger: WorkflowLogger = workflowLogger
    ) {
    }

    execute(input: CreateRideInput, idempotencyKey: string): Ride {
        const fingerprint = JSON.stringify(input);
        const existingRecord = this.idempotencyRecords.get(idempotencyKey);

        if (existingRecord) {
            if (existingRecord.fingerprint !== fingerprint) {
                this.logger.log("error", "ride.creation.idempotency_conflict", {
                    rideId: existingRecord.ride.id,
                    idempotencyKey
                });
                throw new Error("Idempotency key already used with a different request");
            }
            this.logger.log("info", "ride.creation.idempotent_replay", {
                rideId: existingRecord.ride.id,
                idempotencyKey
            });
            return existingRecord.ride;
        }

        if (!this.passengerRepository.exists(input.passengerId)) {
            throw new Error("Passenger does not exist");
        }

        const ride = new Ride(
            randomUUID(),
            input.passengerId,
            new Location(input.pickup.latitude, input.pickup.longitude),
            new Location(input.destination.latitude, input.destination.longitude)
        );

        this.rideRepository.save(ride);
        this.idempotencyRecords.set(idempotencyKey, { fingerprint, ride });
        this.eventBus.publish({
            type: "RideCreated",
            eventId: ride.id,
            occurredAt: new Date(),
            rideId: ride.id
        });
        this.logger.log("info", "ride.created", {
            rideId: ride.id,
            eventId: ride.id,
            passengerId: ride.passengerId,
            status: ride.status
        });
        this.logger.log("info", "ride.event.published", {
            rideId: ride.id,
            eventId: ride.id,
            eventType: "RideCreated"
        });

        return ride;
    }
}
