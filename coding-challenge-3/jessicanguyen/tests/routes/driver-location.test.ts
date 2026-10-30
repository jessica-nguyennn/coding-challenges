import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("PUT /drivers/:driverId/location", () => {
    it("updates and returns the driver's latest location", async () => {
        const firstResponse = await request(app)
            .put("/drivers/D001/location")
            .send({ latitude: 10.7769, longitude: 106.7009 });
        const secondResponse = await request(app)
            .put("/drivers/D001/location")
            .send({ latitude: 10.8231, longitude: 106.6297 });

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body).toMatchObject({
            id: "D001",
            location: {
                latitude: 10.8231,
                longitude: 106.6297
            }
        });
    });

    it("rejects invalid coordinates", async () => {
        const response = await request(app)
            .put("/drivers/D001/location")
            .send({ latitude: 91, longitude: 106.7009 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Latitude must be between -90 and 90");
    });

    it("rejects missing coordinates", async () => {
        const response = await request(app)
            .put("/drivers/D001/location")
            .send({ latitude: 10.7769 });

        expect(response.status).toBe(400);
    });

    it("returns not found for an unknown driver", async () => {
        const response = await request(app)
            .put("/drivers/unknown/location")
            .send({ latitude: 10.7769, longitude: 106.7009 });

        expect(response.status).toBe(404);
    });
});
