import express from "express";
import { CreateRideService } from "./application/create-ride.js";
import { InMemoryPassengerRepository } from "./infrastructure/persistence/in-memory-passenger-repository.js";
import { InMemoryRideRepository } from "./infrastructure/persistence/in-memory-ride-repository.js";
import { createRideRouter } from "./routes/rides.js";

const app = express();

app.use(express.json());

const passengerRepository = new InMemoryPassengerRepository();
const rideRepository = new InMemoryRideRepository();

const createRideService = new CreateRideService(
    passengerRepository,
    rideRepository
);

app.use("/rides", createRideRouter(createRideService));

export default app;