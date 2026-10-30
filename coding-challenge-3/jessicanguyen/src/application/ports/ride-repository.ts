import { Ride } from "../../domain/ride.js";

export interface RideRepository {
    save(ride: Ride): void;
    findById(rideId: string): Ride | undefined;
    findAll(): Ride[];
}