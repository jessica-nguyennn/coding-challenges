import { RideOffer } from "../../domain/ride-offer.js";
import type { RideOfferRepository } from "../../application/ports/ride-offer-repository.js";

export class InMemoryRideOfferRepository implements RideOfferRepository {
    private offers = new Map<string, RideOffer>();

    save(offer: RideOffer): void {
        this.offers.set(offer.id, offer);
    }

    findById(offerId: string): RideOffer | undefined {
        return this.offers.get(offerId);
    }

    findByRideId(rideId: string): RideOffer[] {
        return [...this.offers.values()]
            .filter((offer) => offer.rideId === rideId);
    }
}