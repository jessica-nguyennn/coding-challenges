export interface RideCreatedEvent {
    readonly type: "RideCreated";
    readonly eventId: string;
    readonly occurredAt: Date;
    readonly rideId: string;
}
