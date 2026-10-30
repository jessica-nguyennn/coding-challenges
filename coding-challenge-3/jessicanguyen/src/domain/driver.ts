export type DriverStatus = "OFFLINE" | "AVAILABLE" | "OFFERED" | "BUSY";
export type DriverAvailability = Extract<DriverStatus, "OFFLINE" | "AVAILABLE">;

export class Driver {
    private currentStatus: DriverStatus;

    constructor(
        public readonly id: string,
        status: DriverStatus = "OFFLINE",
        public latitude = 0,
        public longitude = 0
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
}
