import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("PUT /drivers/:driverId/availability", () => {
    beforeEach(async () => {
        await request(app)
            .put("/drivers/D001/availability")
            .send({ status: "OFFLINE" });
    });

    it("allows a driver to switch between OFFLINE and AVAILABLE", async () => {
        const available = await request(app)
            .put("/drivers/D001/availability")
            .send({ status: "AVAILABLE" });

        expect(available.status).toBe(200);
        expect(available.body).toMatchObject({
            id: "D001",
            status: "AVAILABLE"
        });

        const offline = await request(app)
            .put("/drivers/D001/availability")
            .send({ status: "OFFLINE" });

        expect(offline.status).toBe(200);
        expect(offline.body.status).toBe("OFFLINE");
    });

    it("rejects statuses that are not availability states", async () => {
        const response = await request(app)
            .put("/drivers/D001/availability")
            .send({ status: "BUSY" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Status must be OFFLINE or AVAILABLE");
    });

    it("returns not found for an unknown driver", async () => {
        const response = await request(app)
            .put("/drivers/unknown/availability")
            .send({ status: "AVAILABLE" });

        expect(response.status).toBe(404);
    });
});
