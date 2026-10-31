import express from "express";
import { fileURLToPath } from "node:url";
import { CreateRideService } from "./application/rides/create-ride.js";
import { CancelRideService } from "./application/rides/cancel-ride.js";
import { CompleteRideService } from "./application/rides/complete-ride.js";
import { ExpireRideOfferService } from "./application/dispatch/expire-ride-offer.js";
import { InMemoryPassengerRepository } from "./infrastructure/persistence/in-memory-passenger-repository.js";
import { InMemoryRideRepository } from "./infrastructure/persistence/in-memory-ride-repository.js";
import { InMemoryDriverRepository } from "./infrastructure/persistence/in-memory-driver-repository.js";
import { InMemoryRideOfferRepository } from "./infrastructure/persistence/in-memory-ride-offer-repository.js";
import { UpdateDriverAvailabilityService } from "./application/drivers/update-driver-availability.js";
import { UpdateDriverLocationService } from "./application/drivers/update-driver-location.js";
import { CreateRideOfferService } from "./application/dispatch/create-ride-offer.js";
import { DispatchRideService } from "./application/dispatch/dispatch-ride.js";
import { MatchDriverService } from "./application/dispatch/match-driver.js";
import { RespondToRideOfferService } from "./application/dispatch/respond-to-ride-offer.js";
import { createDriverRouter } from "./routes/drivers.js";
import { createRideRouter } from "./routes/rides.js";

const app = express();

app.use(express.json());
app.use(express.static(fileURLToPath(new URL("../public/", import.meta.url))));

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
const expireRideOfferService = new ExpireRideOfferService(
    rideRepository,
    driverRepository,
    rideOfferRepository
);
const dispatchRideService = new DispatchRideService(
    rideRepository,
    rideOfferRepository,
    new MatchDriverService(driverRepository),
    createRideOfferService,
    expireRideOfferService
);
createRideOfferService.setExpirationHandler((rideId, offerId, expiresAt) => {
    const timer = setTimeout(() => {
        if (expireRideOfferService.execute(rideId, offerId)) {
            dispatchRideService.execute(rideId);
        }
    }, Math.max(0, expiresAt.getTime() - Date.now()));
    timer.unref();
});
const respondToRideOfferService = new RespondToRideOfferService(
    rideRepository,
    driverRepository,
    rideOfferRepository,
    dispatchRideService,
    expireRideOfferService
);

app.use("/rides", createRideRouter(
    createRideService,
    createRideOfferService,
    respondToRideOfferService,
    dispatchRideService,
    new CancelRideService(rideRepository, driverRepository, rideOfferRepository),
    new CompleteRideService(rideRepository, driverRepository),
    rideRepository,
    rideOfferRepository
));
app.use("/drivers", createDriverRouter(
    new UpdateDriverAvailabilityService(driverRepository),
    new UpdateDriverLocationService(driverRepository),
    driverRepository
));

export default app;