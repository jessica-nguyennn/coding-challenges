import type { RideRepository } from "../ports/ride-repository.js";
import type { DriverRepository } from "../ports/driver-repository.js";
import type { RideOfferRepository } from "../ports/ride-offer-repository.js";
import type { ExpireRideOfferService } from "./expire-ride-offer.js";
import type { RideOffer } from "../../domain/ride-offer.js";

interface RideDispatcher {
    execute(rideId: string): RideOffer | null;
}

export class RespondToRideOfferService {
    constructor(
        private readonly rideRepository: Pick<
            RideRepository,
            "findById" | "save"
        >,
        private readonly driverRepository: Pick<
            DriverRepository,
            "findById" | "save"
        >,
        private readonly rideOfferRepository: RideOfferRepository,
        private readonly rideDispatcher: RideDispatcher,
        private readonly expireRideOfferService: ExpireRideOfferService
    ) {}

    accept(rideId: string, offerId: string, driverId: string) {
        const offer = this.rideOfferRepository.findById(offerId);

        if (!offer || offer.rideId !== rideId) {
            throw new Error("Ride offer does not exist");
        }

        if (offer.driverId !== driverId) {
            throw new Error("Driver is not authorized to accept this offer");
        }

        if (offer.status !== "PENDING") {
            throw new Error("Ride offer is no longer pending");
        }

        const ride = this.rideRepository.findById(offer.rideId);

        if (!ride) {
            throw new Error("Ride does not exist");
        }

        const driver = this.driverRepository.findById(driverId);

        if (!driver) {
            throw new Error("Driver does not exist");
        }

        if (
            ride.status !== "DRIVER_ASSIGNED" ||
            ride.assignedDriverId !== driverId
        ) {
            throw new Error("Ride is not assigned to this driver");
        }

        if (driver.status !== "OFFERED") {
            throw new Error("Driver does not have a pending offer");
        }

        if (Date.now() >= offer.expiresAt.getTime()) {
            if (this.expireRideOfferService.execute(rideId, offerId)) {
                this.rideDispatcher.execute(rideId);
            }
            throw new Error("Ride offer has expired");
        }

        offer.status = "ACCEPTED";
        ride.status = "DRIVER_ACCEPTED";
        driver.acceptRide();

        this.rideOfferRepository.save(offer);
        this.rideRepository.save(ride);
        this.driverRepository.save(driver);
        return offer;
    }

    reject(rideId: string, offerId: string, driverId: string) {
        const offer = this.rideOfferRepository.findById(offerId);

        if (!offer || offer.rideId !== rideId) {
            throw new Error("Ride offer does not exist");
        }

        if (offer.driverId !== driverId) {
            throw new Error("Driver is not authorized to reject this offer");
        }

        if (offer.status !== "PENDING") {
            throw new Error("Ride offer is no longer pending");
        }

        if (Date.now() >= offer.expiresAt.getTime()) {
            if (this.expireRideOfferService.execute(rideId, offerId)) {
                this.rideDispatcher.execute(rideId);
            }
            throw new Error("Ride offer has expired");
        }

        const ride = this.rideRepository.findById(offer.rideId);

        if (!ride) {
            throw new Error("Ride does not exist");
        }

        const driver = this.driverRepository.findById(driverId);

        if (!driver) {
            throw new Error("Driver does not exist");
        }

        if (
            ride.status !== "DRIVER_ASSIGNED" ||
            ride.assignedDriverId !== driverId
        ) {
            throw new Error("Ride is not assigned to this driver");
        }

        if (driver.status !== "OFFERED") {
            throw new Error("Driver does not have a pending offer");
        }

        offer.status = "REJECTED";
        ride.status = "MATCHING";
        ride.assignedDriverId = null;
        driver.rejectRide();

        this.rideOfferRepository.save(offer);
        this.rideRepository.save(ride);
        this.driverRepository.save(driver);
        this.rideDispatcher.execute(ride.id);
        return offer;
    }
}