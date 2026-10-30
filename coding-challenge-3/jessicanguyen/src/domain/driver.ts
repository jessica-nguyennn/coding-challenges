import type { Location } from "./shared/location.js";

export type DriverStatus = "OFFLINE" | "AVAILABLE" | "OFFERED" | "BUSY";
export type DriverAvailability = Extract<DriverStatus, "OFFLINE" | "AVAILABLE">;

export class Driver {
    private currentStatus: DriverStatus;

    constructor(
        public readonly id: string,
        public location: Location | null = null,
        status: DriverStatus = "OFFLINE"
    ) {
        this.currentStatus = status;
    }

    get status(): DriverStatus {
        return this.currentStatus;
    }

    setAvailability(status: DriverAvailability): void {
        if (this.currentStatus === status) {
            return;
        }

        if (this.currentStatus !== "OFFLINE" && this.currentStatus !== "AVAILABLE") {
            throw new Error(`Driver cannot change availability while ${this.currentStatus}`);
        }

        this.currentStatus = status;
    }

    offerRide(): void {
        if (this.currentStatus !== "AVAILABLE") {
            throw new Error("Only available drivers can receive offers");
        }

        this.currentStatus = "OFFERED";
    }
}
