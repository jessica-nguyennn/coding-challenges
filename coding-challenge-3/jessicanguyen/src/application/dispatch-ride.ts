import type { Ride } from "../domain/ride.js";
import type { RideOffer } from "../domain/ride-offer.js";
import type { RideOfferRepository } from "./ports/ride-offer-repository.js";
import type { RideRepository } from "./ports/ride-repository.js";
import { CreateRideOfferService } from "./create-ride-offer.js";
import { MatchDriverService } from "./match-driver.js";

export class DispatchRideService {
    constructor(
        private readonly rideRepository: Pick<RideRepository, "findById" | "save">,
        private readonly rideOfferRepository: Pick<RideOfferRepository, "findByRideId">,
        private readonly matchDriverService: MatchDriverService,
        private readonly createRideOfferService: CreateRideOfferService
    ) {}

    execute(rideId: string): RideOffer | null {
        const ride = this.rideRepository.findById(rideId);
        if (!ride) {
            throw new Error("Ride does not exist");
        }

        if (ride.status === "DRIVER_ASSIGNED") {
            const pendingOffer = this.rideOfferRepository.findByRideId(rideId)
                .find((offer) => offer.status === "PENDING");
            if (pendingOffer) {
                return pendingOffer;
            }
        }

        if (ride.status === "REQUESTED") {
            ride.status = "MATCHING";
            this.rideRepository.save(ride);
        } else if (ride.status !== "MATCHING") {
            throw new Error("Ride cannot be dispatched in its current state");
        }

        const previousOffers = this.rideOfferRepository.findByRideId(rideId);
        const excludedDriverIds = previousOffers.map((offer) => offer.driverId);
        const driver = this.matchDriverService.execute(
            ride.pickup,
            excludedDriverIds
        );

        if (!driver) {
            return null;
        }

        return this.createRideOfferService.execute(rideId, driver.id);
    }
}
