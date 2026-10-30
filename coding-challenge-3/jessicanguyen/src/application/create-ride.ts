import { randomUUID } from "node:crypto";
import { Ride } from "../domain/ride.js";
import { Location } from "../domain/shared/location.js";
import type { PassengerRepository } from "./ports/passenger-repository.js";
import type { RideRepository } from "./ports/ride-repository.js";


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
        private rideRepository: Pick<RideRepository, "save">
    ) {
    }

    execute(input: CreateRideInput, idempotencyKey: string): Ride {
        const fingerprint = JSON.stringify(input);
        const existingRecord = this.idempotencyRecords.get(idempotencyKey);

        if (existingRecord) {
            if (existingRecord.fingerprint !== fingerprint) {
                throw new Error("Idempotency key already used with a different request");
            }
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

        return ride;
    }
}
