import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBus } from "../../src/infrastructure/events/in-memory-event-bus.js";
import type { RideCreatedEvent } from "../../src/domain/events/ride-created.js";

function rideCreatedEvent(eventId = "event-001"): RideCreatedEvent {
    return {
        type: "RideCreated",
        eventId,
        occurredAt: new Date("2026-10-31T00:00:00.000Z"),
        rideId: "R001"
    };
}

describe("InMemoryEventBus", () => {
    it("queues events without invoking a consumer during publish", async () => {
        const bus = new InMemoryEventBus();
        const handler = vi.fn();

        bus.publish(rideCreatedEvent());

        expect(handler).not.toHaveBeenCalled();
        expect(await bus.consumeNext(handler)).toEqual({
            status: "processed",
            eventId: "event-001"
        });
        expect(handler).toHaveBeenCalledWith(rideCreatedEvent());
    });

    it("returns empty when no event is queued", async () => {
        const bus = new InMemoryEventBus();

        await expect(bus.consumeNext(vi.fn())).resolves.toEqual({ status: "empty" });
    });

    it("retries failed events up to the configured attempt limit and exposes dead letters", async () => {
        const bus = new InMemoryEventBus(2);
        const handler = vi.fn(() => {
            throw new Error("temporary dispatch failure");
        });
        bus.publish(rideCreatedEvent());

        await expect(bus.consumeNext(handler)).resolves.toEqual({
            status: "retrying",
            eventId: "event-001",
            attempt: 1,
            error: "temporary dispatch failure"
        });
        await expect(bus.consumeNext(handler)).resolves.toEqual({
            status: "dead-lettered",
            eventId: "event-001",
            attempt: 2,
            error: "temporary dispatch failure"
        });

        expect(handler).toHaveBeenCalledTimes(2);
        expect(bus.getDeadLetters()).toHaveLength(1);
        expect(await bus.consumeNext(handler)).toEqual({ status: "empty" });
    });
});
