import { randomUUID } from "node:crypto";
import { Ride } from "../domain/ride.js";
import { Location } from "../domain/shared/location.js";


interface PassengerRepository {
    exists(passengerId: string): boolean;
}

interface RideRepository {
    save(ride: Ride): void;
}

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
    constructor(
        private passengerRepository: PassengerRepository,
        private rideRepository: RideRepository
    ) {
    }

    execute(input: CreateRideInput): Ride {
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

        return ride;
    }
}
