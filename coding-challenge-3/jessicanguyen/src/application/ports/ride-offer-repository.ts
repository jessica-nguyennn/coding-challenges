import type { RideOffer } from "../../domain/ride-offer.js";

export interface RideOfferRepository {
    save(offer: RideOffer): void;
}