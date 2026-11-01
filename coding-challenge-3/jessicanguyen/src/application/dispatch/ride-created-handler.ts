import type { RideCreatedEvent } from "../../domain/events/ride-created.js";
import type { DispatchRideService } from "./dispatch-ride.js";
import { workflowLogger, type WorkflowLogger } from "../ports/workflow-logger.js";

export class RideCreatedHandler {
    private readonly processedEventIds = new Set<string>();

    constructor(
        private readonly dispatchRideService: Pick<DispatchRideService, "execute">,
        private readonly logger: WorkflowLogger = workflowLogger
    ) {}

    async handle(event: RideCreatedEvent): Promise<void> {
        if (this.processedEventIds.has(event.eventId)) {
            this.logger.log("info", "ride.event.duplicate_ignored", {
                rideId: event.rideId,
                eventId: event.eventId,
                eventType: event.type
            });
            return;
        }

        this.logger.log("info", "ride.event.consuming", {
            rideId: event.rideId,
            eventId: event.eventId,
            eventType: event.type
        });
        try {
            this.dispatchRideService.execute(event.rideId);
        } catch (error) {
            this.logger.log("error", "ride.event.handler_failed", {
                rideId: event.rideId,
                eventId: event.eventId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
        this.processedEventIds.add(event.eventId);
        this.logger.log("info", "ride.event.processed", {
            rideId: event.rideId,
            eventId: event.eventId,
            eventType: event.type
        });
    }
}
