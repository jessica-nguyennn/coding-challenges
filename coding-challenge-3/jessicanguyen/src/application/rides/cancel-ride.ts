import type { RideRepository } from "../ports/ride-repository.js";
import type { DriverRepository } from "../ports/driver-repository.js";
import type { RideOfferRepository } from "../ports/ride-offer-repository.js";

export class CancelRideService {
    constructor(
        private readonly rideRepository: Pick<RideRepository, "findById" | "save">,
        private readonly driverRepository: Pick<DriverRepository, "findById" | "save">,
        private readonly rideOfferRepository: Pick<RideOfferRepository, "findByRideId" | "save">
    ) {}

    execute(rideId: string): void {
        const ride = this.rideRepository.findById(rideId);

        if (!ride) {
            throw new Error("Ride does not exist");
        }

        if (ride.status === "CANCELLED") {
            return;
        }

        const cancellableStatuses = [
            "REQUESTED",
            "MATCHING",
            "DRIVER_ASSIGNED",
            "DRIVER_ACCEPTED"
        ];

        if (!cancellableStatuses.includes(ride.status)) {
            throw new Error("Ride cannot be cancelled in its current state");
        }

        // No driver has been assigned, so only the ride needs updating.
        if (ride.status === "REQUESTED" || ride.status === "MATCHING") {
            ride.transitionTo("CANCELLED");
            this.rideRepository.save(ride);
            return;
        }

        // A driver has been assigned or has accepted the ride.
        const driverId = ride.assignedDriverId;

        if (!driverId) {
            throw new Error("Assigned driver does not exist");
        }

        const driver = this.driverRepository.findById(driverId);

        if (!driver) {
            throw new Error("Driver does not exist");
        }

        const offers = this.rideOfferRepository.findByRideId(rideId);

        if (ride.status === "DRIVER_ASSIGNED") {
            const offer = offers.find(
                (item) => item.driverId === driverId && item.status === "PENDING"
            );

            if (!offer) {
                throw new Error("Pending ride offer does not exist");
            }

            offer.status = "CANCELLED";
            driver.releaseFromOffer();

            this.rideOfferRepository.save(offer);
        } else {
            const offer = offers.find(
                (item) => item.driverId === driverId && item.status === "ACCEPTED"
            );

            if (!offer) {
                throw new Error("Accepted ride offer does not exist");
            }

            driver.releaseFromAcceptedRide();
        }

        ride.transitionTo("CANCELLED");

        this.driverRepository.save(driver);
        this.rideRepository.save(ride);
    }
}