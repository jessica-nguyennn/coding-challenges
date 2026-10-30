import type { RideOffer } from "../../domain/ride-offer.js";

export interface RideOfferRepository {
    save(offer: RideOffer): void;
    findById(offerId: string): RideOffer | undefined;
    findByRideId(rideId: string): RideOffer[];
}