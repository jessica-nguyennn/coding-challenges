import express from "express";
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { CreateRideService } from "../../src/application/create-ride.js";
import { CreateRideOfferService } from "../../src/application/create-ride-offer.js";
import { DispatchRideService } from "../../src/application/dispatch-ride.js";
import { CancelRideService } from "../../src/application/cancel-ride.js";
import { CompleteRideService } from "../../src/application/complete-ride.js";
import { ExpireRideOfferService } from "../../src/application/expire-ride-offer.js";
import { MatchDriverService } from "../../src/application/match-driver.js";
import { RespondToRideOfferService } from "../../src/application/respond-to-ride-offer.js";
import { Driver } from "../../src/domain/driver.js";
import { Location } from "../../src/domain/shared/location.js";
import { Ride } from "../../src/domain/ride.js";
import { InMemoryDriverRepository } from "../../src/infrastructure/persistence/in-memory-driver-repository.js";
import { InMemoryRideOfferRepository } from "../../src/infrastructure/persistence/in-memory-ride-offer-repository.js";
import { InMemoryRideRepository } from "../../src/infrastructure/persistence/in-memory-ride-repository.js";
import { createRideRouter } from "../../src/routes/rides.js";

describe("ride offer endpoints", () => {
    let app: express.Express;
    let rides: InMemoryRideRepository;
    let drivers: InMemoryDriverRepository;
    let offers: InMemoryRideOfferRepository;

    beforeEach(() => {
        rides = new InMemoryRideRepository();
        drivers = new InMemoryDriverRepository();
        offers = new InMemoryRideOfferRepository();

        const ride = new Ride(
            "R001",
            "P001",
            new Location(10.7769, 106.7009),
            new Location(10.8231, 106.6297)
        );
        ride.status = "MATCHING";
        rides.save(ride);
        drivers.save(new Driver(
            "D001",
            new Location(10.777, 106.701),
            "AVAILABLE"
        ));

        app = express();
        app.use(express.json());
        const createOfferService = new CreateRideOfferService(rides, drivers, offers);
        const expireOfferService = new ExpireRideOfferService(rides, drivers, offers);
        const dispatchService = new DispatchRideService(
            rides,
            offers,
            new MatchDriverService(drivers),
            createOfferService,
            expireOfferService
        );
        app.use("/rides", createRideRouter(
            new CreateRideService({ exists: () => true }, rides),
            createOfferService,
            new RespondToRideOfferService(
                rides,
                drivers,
                offers,
                dispatchService,
                expireOfferService
            ),
            dispatchService,
            new CancelRideService(rides, drivers, offers),
            new CompleteRideService(rides, drivers),
            rides,
            offers
        ));
    });

    it("lists rides and their offer history for the dashboard", async () => {
        const rideResponse = await request(app).get("/rides");
        const offerResponse = await request(app).get("/rides/R001/offers");

        expect(rideResponse.status).toBe(200);
        expect(rideResponse.body).toHaveLength(1);
        expect(rideResponse.body[0]).toMatchObject({
            id: "R001",
            status: "MATCHING"
        });
        expect(offerResponse.status).toBe(200);
        expect(offerResponse.body).toEqual([]);
    });

    it("creates an offer under the ride resource", async () => {
        const response = await request(app)
            .post("/rides/R001/offers")
            .send({ driverId: "D001" });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            rideId: "R001",
            driverId: "D001",
            status: "PENDING"
        });
        expect(rides.findById("R001")?.status).toBe("DRIVER_ASSIGNED");
        expect(drivers.findById("D001")?.status).toBe("OFFERED");
    });

    it("accepts an offer using its resource ID and driver ID", async () => {
        const created = await request(app)
            .post("/rides/R001/offers")
            .send({ driverId: "D001" });

        const response = await request(app)
            .post(`/rides/R001/offers/${created.body.id}/accept`)
            .send({ driverId: "D001" });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("ACCEPTED");
        expect(rides.findById("R001")?.status).toBe("DRIVER_ACCEPTED");
        expect(drivers.findById("D001")?.status).toBe("BUSY");
    });

    it("rejects an offer and returns the ride to matching", async () => {
        const created = await request(app)
            .post("/rides/R001/offers")
            .send({ driverId: "D001" });

        const response = await request(app)
            .post(`/rides/R001/offers/${created.body.id}/reject`)
            .send({ driverId: "D001" });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("REJECTED");
        expect(rides.findById("R001")?.status).toBe("MATCHING");
        expect(rides.findById("R001")?.assignedDriverId).toBeNull();
        expect(drivers.findById("D001")?.status).toBe("AVAILABLE");
    });

    it("rejects a response when the offer belongs to a different ride", async () => {
        const created = await request(app)
            .post("/rides/R001/offers")
            .send({ driverId: "D001" });

        const response = await request(app)
            .post(`/rides/R002/offers/${created.body.id}/accept`)
            .send({ driverId: "D001" });

        expect(response.status).toBe(404);
    });

    it("rejects a response from a driver other than the offer owner", async () => {
        const created = await request(app)
            .post("/rides/R001/offers")
            .send({ driverId: "D001" });

        const response = await request(app)
            .post(`/rides/R001/offers/${created.body.id}/accept`)
            .send({ driverId: "D002" });

        expect(response.status).toBe(403);
    });

    it("cancels a ride with a pending offer and releases its driver", async () => {
        await request(app)
            .post("/rides/R001/offers")
            .send({ driverId: "D001" });

        const response = await request(app).post("/rides/R001/cancel");

        expect(response.status).toBe(204);
        expect(rides.findById("R001")?.status).toBe("CANCELLED");
        expect(drivers.findById("D001")?.status).toBe("AVAILABLE");
        expect(offers.findByRideId("R001")[0]?.status).toBe("CANCELLED");
    });

    it("completes an accepted ride and releases its driver", async () => {
        const created = await request(app)
            .post("/rides/R001/offers")
            .send({ driverId: "D001" });
        await request(app)
            .post(`/rides/R001/offers/${created.body.id}/accept`)
            .send({ driverId: "D001" });

        const response = await request(app).post("/rides/R001/complete");

        expect(response.status).toBe(204);
        expect(rides.findById("R001")?.status).toBe("COMPLETED");
        expect(drivers.findById("D001")?.status).toBe("AVAILABLE");
    });

    it("rejects completing a ride that has not been accepted", async () => {
        const response = await request(app).post("/rides/R001/complete");

        expect(response.status).toBe(409);
        expect(rides.findById("R001")?.status).toBe("MATCHING");
    });
});
