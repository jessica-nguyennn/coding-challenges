import { describe, expect, it } from "vitest";
import { RideCreatedHandler } from "../../src/application/dispatch/ride-created-handler.js";
import { DispatchRideService } from "../../src/application/dispatch/dispatch-ride.js";
import { CreateRideOfferService } from "../../src/application/dispatch/create-ride-offer.js";
import { ExpireRideOfferService } from "../../src/application/dispatch/expire-ride-offer.js";
import { MatchDriverService } from "../../src/application/dispatch/match-driver.js";
import { CreateRideService } from "../../src/application/rides/create-ride.js";
import { Driver } from "../../src/domain/driver.js";
import { Location } from "../../src/domain/shared/location.js";
import { InMemoryEventBus } from "../../src/infrastructure/events/in-memory-event-bus.js";
import { InMemoryDriverRepository } from "../../src/infrastructure/persistence/in-memory-driver-repository.js";
import { InMemoryPassengerRepository } from "../../src/infrastructure/persistence/in-memory-passenger-repository.js";
import { InMemoryRideOfferRepository } from "../../src/infrastructure/persistence/in-memory-ride-offer-repository.js";
import { InMemoryRideRepository } from "../../src/infrastructure/persistence/in-memory-ride-repository.js";

describe("RideCreated asynchronous dispatch", () => {
    it("returns from ride creation before dispatch and dispatches when consumed", async () => {
        const eventBus = new InMemoryEventBus();
        const rides = new InMemoryRideRepository();
        const drivers = new InMemoryDriverRepository();
        const offers = new InMemoryRideOfferRepository();
        drivers.save(new Driver(
            "D100",
            new Location(10.777, 106.701),
            "AVAILABLE"
        ));

        const createOffer = new CreateRideOfferService(rides, drivers, offers);
        const expireOffer = new ExpireRideOfferService(rides, drivers, offers);
        const dispatch = new DispatchRideService(
            rides,
            offers,
            new MatchDriverService(drivers),
            createOffer,
            expireOffer
        );
        const handler = new RideCreatedHandler(dispatch);
        const createRide = new CreateRideService(
            new InMemoryPassengerRepository(),
            rides,
            eventBus
        );

        const ride = createRide.execute({
            passengerId: "P001",
            pickup: { latitude: 10.7769, longitude: 106.7009 },
            destination: { latitude: 10.8231, longitude: 106.6297 }
        }, "request-async-001");

        expect(ride.status).toBe("REQUESTED");
        expect(offers.findByRideId(ride.id)).toHaveLength(0);

        await expect(eventBus.consumeNext((event) => handler.handle(event)))
            .resolves.toMatchObject({ status: "processed", eventId: ride.id });

        expect(ride.status).toBe("DRIVER_ASSIGNED");
        expect(offers.findByRideId(ride.id)).toHaveLength(1);

        eventBus.publish({
            type: "RideCreated",
            eventId: ride.id,
            occurredAt: new Date(),
            rideId: ride.id
        });
        await eventBus.consumeNext((event) => handler.handle(event));

        expect(offers.findByRideId(ride.id)).toHaveLength(1);
    });
});
