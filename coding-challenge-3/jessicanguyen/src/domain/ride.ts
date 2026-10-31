import { Location } from "./shared/location.js";

export type RideStatus = "REQUESTED" | "MATCHING" | "DRIVER_ASSIGNED" | "DRIVER_ACCEPTED" | "CANCELLED" | "COMPLETED";

const validTransitions: Record<RideStatus, readonly RideStatus[]> = {
    REQUESTED: ["MATCHING", "CANCELLED"],
    MATCHING: ["DRIVER_ASSIGNED", "CANCELLED"],
    DRIVER_ASSIGNED: ["MATCHING", "DRIVER_ACCEPTED", "CANCELLED"],
    DRIVER_ACCEPTED: ["CANCELLED", "COMPLETED"],
    CANCELLED: [],
    COMPLETED: []
};

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

    transitionTo(nextStatus: RideStatus): boolean {
        if (nextStatus === this.status) {
            return false;
        }

        if (!validTransitions[this.status].includes(nextStatus)) {
            throw new Error(
                `Invalid ride status transition: ${this.status} -> ${nextStatus}`
            );
        }

        this.status = nextStatus;
        return true;
    }
}