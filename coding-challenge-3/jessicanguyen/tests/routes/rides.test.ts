import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("POST /rides", () => {
    it("should create a ride successfully", async () => {
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
});