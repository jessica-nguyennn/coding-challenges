import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("POST /rides", () => {
    it("should return 200 when create a ride successfully", async () => {
        const response = await request(app)
                        .post("/rides")
                        .set("Idempotency-Key", "request-001")
                        .send({
                            passengerId: "P001",
                            pickup: {
                                latitude: 10.7769,
                                longitude: 106.7009
                            },
                            destination: {
                                latitude: 10.8231,
                                longitude: 106.6297
                            }
                        });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty("id");
        expect(response.body.passengerId).toBe("P001");
        expect(response.body.status).toBe("REQUESTED");
        expect(response.body.assignedDriverId).toBeNull();
    });

    it("should return 400 when pickup coordinates are invalid", async () => {
        const response = await request(app)
            .post("/rides")
            .set("Idempotency-Key", "request-invalid-pickup")
            .send({
                passengerId: "P001",
                pickup: {
                    latitude: 100,
                    longitude: 106.7009
                },
                destination: {
                    latitude: 10.8231,
                    longitude: 106.6297
                }
            });

        expect(response.status).toBe(400);
    });

    it("should return 400 when destination coordinates are invalid", async () => {
        const response = await request(app)
            .post("/rides")
            .set("Idempotency-Key", "request-invalid-destination")
            .send({
                passengerId: "P001",
                pickup: {
                    latitude: 10.7769,
                    longitude: 106.7009
                },
                destination: {
                    latitude: 10.8231,
                    longitude: 200
                }
            });

        expect(response.status).toBe(400);
    });

    it("should return 404 when passenger does not exist", async () => {
        const response = await request(app)
            .post("/rides")
            .set("Idempotency-Key", "request-unknown-passenger")
            .send({
                passengerId: "P999",
                pickup: {
                    latitude: 10.7769,
                    longitude: 106.7009
                },
                destination: {
                    latitude: 10.8231,
                    longitude: 106.6297
                }
            });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Passenger does not exist");
    });

    it("should return the same ride when the same request is submitted twice", async () => {
        const requestBody = {
            passengerId: "P001",
            pickup: {
                latitude: 10.7769,
                longitude: 106.7009
            },
            destination: {
                latitude: 10.8231,
                longitude: 106.6297
            }
        };

        const firstResponse = await request(app)
            .post("/rides")
            .set("Idempotency-Key", "request-same-ride")
            .send(requestBody);

        const secondResponse = await request(app)
            .post("/rides")
            .set("Idempotency-Key", "request-same-ride")
            .send(requestBody);

        expect(firstResponse.status).toBe(201);
        expect(secondResponse.status).toBe(201);

        expect(secondResponse.body.id).toBe(firstResponse.body.id);
    });

    it("should return 409 when the same idempotency key is used with a different request", async () => {
        const firstRequest = {
            passengerId: "P001",
            pickup: {
                latitude: 10.7769,
                longitude: 106.7009
            },
            destination: {
                latitude: 10.8231,
                longitude: 106.6297
            }
        };

        const secondRequest = {
            ...firstRequest,
            destination: {
                latitude: 10.8500,
                longitude: 106.6500
            }
        };

        await request(app)
            .post("/rides")
            .set("Idempotency-Key", "request-conflict")
            .send(firstRequest);

        const response = await request(app)
            .post("/rides")
            .set("Idempotency-Key", "request-conflict")
            .send(secondRequest);

        expect(response.status).toBe(409);
        expect(response.body.error).toBe(
            "Idempotency key already used with a different request"
        );
    });
});