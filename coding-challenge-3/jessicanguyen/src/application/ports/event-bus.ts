import type { RideCreatedEvent } from "../../domain/events/ride-created.js";

export type EventConsumptionResult =
    | { status: "empty" }
    | { status: "processed"; eventId: string }
    | { status: "retrying"; eventId: string; attempt: number; error: string }
    | { status: "dead-lettered"; eventId: string; attempt: number; error: string };

export interface DeadLetter {
    event: RideCreatedEvent;
    attempts: number;
    error: string;
}

export interface EventBus {
    publish(event: RideCreatedEvent): void;
    consumeNext(
        handler: (event: RideCreatedEvent) => void | Promise<void>
    ): Promise<EventConsumptionResult>;
    getDeadLetters(): readonly DeadLetter[];
}
