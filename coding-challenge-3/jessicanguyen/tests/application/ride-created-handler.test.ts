import { describe, expect, it, vi } from "vitest";
import { RideCreatedHandler } from "../../src/application/dispatch/ride-created-handler.js";
import type { RideCreatedEvent } from "../../src/domain/events/ride-created.js";

const event: RideCreatedEvent = {
    type: "RideCreated",
    eventId: "event-001",
    occurredAt: new Date("2026-10-31T00:00:00.000Z"),
    rideId: "R001"
};

describe("RideCreatedHandler", () => {
    it("dispatches a ride once when an event is delivered more than once", async () => {
        const dispatchRide = { execute: vi.fn().mockReturnValue(null) };
        const logger = { log: vi.fn() };
        const handler = new RideCreatedHandler(dispatchRide, logger);

        await handler.handle(event);
        await handler.handle(event);

        expect(dispatchRide.execute).toHaveBeenCalledTimes(1);
        expect(dispatchRide.execute).toHaveBeenCalledWith("R001");
        expect(logger.log).toHaveBeenCalledWith(
            "info",
            "ride.event.duplicate_ignored",
            expect.objectContaining({ rideId: "R001", eventId: "event-001" })
        );
    });

    it("does not mark an event processed when dispatch fails, allowing retry", async () => {
        const dispatchRide = {
            execute: vi.fn()
                .mockImplementationOnce(() => { throw new Error("dispatch failed"); })
                .mockReturnValueOnce(null)
        };
        const handler = new RideCreatedHandler(dispatchRide);

        await expect(handler.handle(event)).rejects.toThrow("dispatch failed");
        await expect(handler.handle(event)).resolves.toBeUndefined();

        expect(dispatchRide.execute).toHaveBeenCalledTimes(2);
    });
});
