import express from "express";
import { CreateRideService } from "./application/create-ride.js";
import { InMemoryPassengerRepository } from "./infrastructure/persistence/in-memory-passenger-repository.js";
import { InMemoryRideRepository } from "./infrastructure/persistence/in-memory-ride-repository.js";
import { InMemoryDriverRepository } from "./infrastructure/persistence/in-memory-driver-repository.js";
import { InMemoryRideOfferRepository } from "./infrastructure/persistence/in-memory-ride-offer-repository.js";
import { UpdateDriverAvailabilityService } from "./application/update-driver-availability.js";
import { UpdateDriverLocationService } from "./application/update-driver-location.js";
import { CreateRideOfferService } from "./application/create-ride-offer.js";
import { RespondToRideOfferService } from "./application/respond-to-ride-offer.js";
import { createDriverRouter } from "./routes/drivers.js";
import { createRideRouter } from "./routes/rides.js";

const app = express();

app.use(express.json());

const passengerRepository = new InMemoryPassengerRepository();
const rideRepository = new InMemoryRideRepository();
const driverRepository = new InMemoryDriverRepository();
const rideOfferRepository = new InMemoryRideOfferRepository();

const createRideService = new CreateRideService(
    passengerRepository,
    rideRepository
);

app.use("/rides", createRideRouter(
    createRideService,
    new CreateRideOfferService(rideRepository, driverRepository, rideOfferRepository),
    new RespondToRideOfferService(rideRepository, driverRepository, rideOfferRepository)
));
app.use("/drivers", createDriverRouter(
    new UpdateDriverAvailabilityService(driverRepository),
    new UpdateDriverLocationService(driverRepository)
));

export default app;