import { Location } from "./shared/location.js";

export type RideStatus = "REQUESTED" | "MATCHING" | "DRIVER_ASSIGNED" | "DRIVER_ACCEPTED" | "CANCELLED" | "COMPLETED";

export class Ride {
    public readonly id: string;
    public readonly passengerId: string;
    public readonly pickup: Location;
    public readonly destination: Location;
    public status: RideStatus;
    public assignedDriverId: string | null;

    constructor(
        id: string,
        passengerId: string,
        pickup: Location,
        destination: Location
    ) {
        this.id = id;
        this.passengerId = passengerId;
        this.pickup = pickup;
        this.destination = destination;
        this.status = "REQUESTED";
        this.assignedDriverId = null;
    }
}