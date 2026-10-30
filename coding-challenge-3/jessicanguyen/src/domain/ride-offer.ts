export type RideOfferStatus =
    | "PENDING"
    | "ACCEPTED"
    | "REJECTED"
    | "EXPIRED";

export class RideOffer {
    constructor(
        public readonly id: string,
        public readonly rideId: string,
        public readonly driverId: string,
        public readonly createdAt: Date,
        public readonly expiresAt: Date,
        public status: RideOfferStatus = "PENDING"
    ) {}
}