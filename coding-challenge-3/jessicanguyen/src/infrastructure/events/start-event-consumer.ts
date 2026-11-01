import type { EventBus } from "../../application/ports/event-bus.js";
import type { RideCreatedHandler } from "../../application/dispatch/ride-created-handler.js";
import { workflowLogger, type WorkflowLogger } from "../../application/ports/workflow-logger.js";

export function startEventConsumer(
    eventBus: EventBus,
    handler: RideCreatedHandler,
    pollIntervalMs = 25,
    logger: WorkflowLogger = workflowLogger
): () => void {
    let consuming = false;
    const timer = setInterval(async () => {
        if (consuming) {
            return;
        }

        consuming = true;
        try {
            const result = await eventBus.consumeNext((event) => handler.handle(event));
            if (result.status === "retrying" || result.status === "dead-lettered") {
                logger.log(
                    result.status === "dead-lettered" ? "error" : "info",
                    `ride.event.${result.status}`,
                    {
                        eventId: result.eventId,
                        attempt: result.attempt,
                        error: result.error
                    }
                );
            }
        } finally {
            consuming = false;
        }
    }, pollIntervalMs);

    timer.unref();
    return () => clearInterval(timer);
}
