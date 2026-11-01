import type { RideRepository } from "../ports/ride-repository.js";
import type { DriverRepository } from "../ports/driver-repository.js";
import { workflowLogger, type WorkflowLogger } from "../ports/workflow-logger.js";

export class CompleteRideService {
    constructor(
        private readonly rideRepository: Pick<RideRepository, "findById" | "save">,
        private readonly driverRepository: Pick<DriverRepository, "findById" | "save">,
        private readonly logger: WorkflowLogger = workflowLogger
    ) {}

    execute(rideId: string): void {
        const ride = this.rideRepository.findById(rideId);

        if (!ride) {
            throw new Error("Ride does not exist");
        }
        if (ride.status === "COMPLETED") {
            this.logger.log("info", "ride.completion.duplicate_ignored", { rideId });
            return;
        }
        if (ride.status !== "DRIVER_ACCEPTED") {
            throw new Error("Only accepted rides can be completed");
        }

        const driverId = ride.assignedDriverId;

        if (!driverId) {
            throw new Error("Assigned driver does not exist");
        }

        const driver = this.driverRepository.findById(driverId);

        if (!driver) {
            throw new Error("Driver does not exist");
        }

        ride.transitionTo("COMPLETED");
        driver.completeRide();

        this.rideRepository.save(ride);
        this.driverRepository.save(driver);
        this.logger.log("info", "ride.completed", {
            rideId,
            driverId,
            rideStatus: ride.status,
            driverStatus: driver.status
        });
    }
}