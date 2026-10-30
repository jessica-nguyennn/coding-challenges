import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("dashboard static assets", () => {
    it("serves the dashboard at the application root", async () => {
        const response = await request(app).get("/");

        expect(response.status).toBe(200);
        expect(response.type).toBe("text/html");
        expect(response.text).toContain("Operations dashboard");
        expect(response.text).toContain('src="/dashboard.js"');
    });

    it("serves dashboard styles and API client script", async () => {
        const [styles, script] = await Promise.all([
            request(app).get("/styles.css"),
            request(app).get("/dashboard.js")
        ]);

        expect(styles.status).toBe(200);
        expect(styles.type).toBe("text/css");
        expect(script.status).toBe(200);
        expect(script.text).toContain('"/drivers"');
        expect(script.text).toContain('"Idempotency-Key"');
    });
});
