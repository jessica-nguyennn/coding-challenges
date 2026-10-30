import { Ride } from "../../domain/ride.js";
import type { RideRepository } from "../../application/ports/ride-repository.js";

export class InMemoryRideRepository implements RideRepository {
    private rides = new Map<string, Ride>();

    save(ride: Ride): void {
        this.rides.set(ride.id, ride);
    }

    findById(rideId: string): Ride | undefined {
        return this.rides.get(rideId);
    }

    findAll(): Ride[] {
        return [...this.rides.values()];
    }
}