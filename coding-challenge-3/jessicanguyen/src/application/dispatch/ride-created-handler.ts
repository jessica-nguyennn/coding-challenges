import type { RideCreatedEvent } from "../../domain/events/ride-created.js";
import type { DispatchRideService } from "./dispatch-ride.js";

export class RideCreatedHandler {
    private readonly processedEventIds = new Set<string>();

    constructor(private readonly dispatchRideService: Pick<DispatchRideService, "execute">) {}

    async handle(event: RideCreatedEvent): Promise<void> {
        if (this.processedEventIds.has(event.eventId)) {
            return;
        }

        this.dispatchRideService.execute(event.rideId);
        this.processedEventIds.add(event.eventId);
    }
}
