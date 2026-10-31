import type { DriverRepository } from "../ports/driver-repository.js";
import type { RideOfferRepository } from "../ports/ride-offer-repository.js";
import type { RideRepository } from "../ports/ride-repository.js";

export class ExpireRideOfferService {
    constructor(
        private readonly rideRepository: Pick<RideRepository, "findById" | "save">,
        private readonly driverRepository: Pick<DriverRepository, "findById" | "save">,
        private readonly rideOfferRepository: Pick<RideOfferRepository, "findById" | "save">
    ) {}

    execute(rideId: string, offerId: string, now = new Date()): boolean {
        const offer = this.rideOfferRepository.findById(offerId);
        if (!offer || offer.rideId !== rideId) {
            throw new Error("Ride offer does not exist");
        }

        if (offer.status !== "PENDING" || now < offer.expiresAt) {
            return false;
        }

        const ride = this.rideRepository.findById(rideId);
        if (!ride) {
            throw new Error("Ride does not exist");
        }

        const driver = this.driverRepository.findById(offer.driverId);
        if (!driver) {
            throw new Error("Driver does not exist");
        }

        if (
            ride.status !== "DRIVER_ASSIGNED" ||
            ride.assignedDriverId !== driver.id ||
            driver.status !== "OFFERED"
        ) {
            throw new Error("Ride offer is no longer assigned");
        }

        offer.status = "EXPIRED";
        ride.status = "MATCHING";
        ride.assignedDriverId = null;
        driver.rejectRide();

        this.rideOfferRepository.save(offer);
        this.rideRepository.save(ride);
        this.driverRepository.save(driver);

        return true;
    }
}
