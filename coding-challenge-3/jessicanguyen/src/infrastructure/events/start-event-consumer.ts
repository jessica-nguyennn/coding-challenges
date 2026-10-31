import type { EventBus } from "../../application/ports/event-bus.js";
import type { RideCreatedHandler } from "../../application/dispatch/ride-created-handler.js";

export function startEventConsumer(
    eventBus: EventBus,
    handler: RideCreatedHandler,
    pollIntervalMs = 25
): () => void {
    let consuming = false;
    const timer = setInterval(async () => {
        if (consuming) {
            return;
        }

        consuming = true;
        try {
            const result = await eventBus.consumeNext((event) => handler.handle(event));
            if (result.status === "dead-lettered") {
                console.error(
                    `Event ${result.eventId} dead-lettered after ${result.attempt} attempts: ${result.error}`
                );
            }
        } finally {
            consuming = false;
        }
    }, pollIntervalMs);

    timer.unref();
    return () => clearInterval(timer);
}
