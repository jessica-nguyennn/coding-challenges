import type {
    DeadLetter,
    EventBus,
    EventConsumptionResult
} from "../../application/ports/event-bus.js";
import type { RideCreatedEvent } from "../../domain/events/ride-created.js";

interface QueuedEvent {
    event: RideCreatedEvent;
    attempts: number;
}

export class InMemoryEventBus implements EventBus {
    private readonly queue: QueuedEvent[] = [];
    private readonly deadLetters: DeadLetter[] = [];

    constructor(private readonly maxAttempts = 3) {
        if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
            throw new Error("Maximum event attempts must be a positive integer");
        }
    }

    publish(event: RideCreatedEvent): void {
        this.queue.push({ event: { ...event }, attempts: 0 });
    }

    async consumeNext(
        handler: (event: RideCreatedEvent) => void | Promise<void>
    ): Promise<EventConsumptionResult> {
        const queuedEvent = this.queue.shift();
        if (!queuedEvent) {
            return { status: "empty" };
        }

        try {
            await handler(queuedEvent.event);
            return {
                status: "processed",
                eventId: queuedEvent.event.eventId
            };
        } catch (error) {
            queuedEvent.attempts += 1;
            const message = error instanceof Error ? error.message : String(error);

            if (queuedEvent.attempts >= this.maxAttempts) {
                this.deadLetters.push({
                    event: queuedEvent.event,
                    attempts: queuedEvent.attempts,
                    error: message
                });
                return {
                    status: "dead-lettered",
                    eventId: queuedEvent.event.eventId,
                    attempt: queuedEvent.attempts,
                    error: message
                };
            }

            this.queue.push(queuedEvent);
            return {
                status: "retrying",
                eventId: queuedEvent.event.eventId,
                attempt: queuedEvent.attempts,
                error: message
            };
        }
    }

    getDeadLetters(): readonly DeadLetter[] {
        return this.deadLetters;
    }
}
