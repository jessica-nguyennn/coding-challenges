import express from "express";
import { CreateRideService } from "./application/create-ride.js";
import { InMemoryPassengerRepository } from "./infrastructure/persistence/in-memory-passenger-repository.js";
import { InMemoryRideRepository } from "./infrastructure/persistence/in-memory-ride-repository.js";
import { InMemoryDriverRepository } from "./infrastructure/persistence/in-memory-driver-repository.js";
import { InMemoryRideOfferRepository } from "./infrastructure/persistence/in-memory-ride-offer-repository.js";
import { UpdateDriverAvailabilityService } from "./application/update-driver-availability.js";
import { UpdateDriverLocationService } from "./application/update-driver-location.js";
import { CreateRideOfferService } from "./application/create-ride-offer.js";
import { DispatchRideService } from "./application/dispatch-ride.js";
import { MatchDriverService } from "./application/match-driver.js";
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
const createRideOfferService = new CreateRideOfferService(
    rideRepository,
    driverRepository,
    rideOfferRepository
);
const dispatchRideService = new DispatchRideService(
    rideRepository,
    rideOfferRepository,
    new MatchDriverService(driverRepository),
    createRideOfferService
);

app.use("/rides", createRideRouter(
    createRideService,
    createRideOfferService,
    new RespondToRideOfferService(rideRepository, driverRepository, rideOfferRepository),
    dispatchRideService
));
app.use("/drivers", createDriverRouter(
    new UpdateDriverAvailabilityService(driverRepository),
    new UpdateDriverLocationService(driverRepository)
));

export default app;