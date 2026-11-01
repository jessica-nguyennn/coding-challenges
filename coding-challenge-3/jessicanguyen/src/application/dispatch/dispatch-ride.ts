import type { Ride } from "../../domain/ride.js";
import type { RideOffer } from "../../domain/ride-offer.js";
import type { RideOfferRepository } from "../ports/ride-offer-repository.js";
import type { RideRepository } from "../ports/ride-repository.js";
import {
    CreateRideOfferService,
    DriverNotAvailableError
} from "./create-ride-offer.js";
import { ExpireRideOfferService } from "./expire-ride-offer.js";
import { MatchDriverService } from "./match-driver.js";
import { workflowLogger, type WorkflowLogger } from "../ports/workflow-logger.js";

export class DispatchRideService {
    constructor(
        private readonly rideRepository: Pick<RideRepository, "findById" | "save">,
        private readonly rideOfferRepository: Pick<RideOfferRepository, "findByRideId">,
        private readonly matchDriverService: MatchDriverService,
        private readonly createRideOfferService: CreateRideOfferService,
        private readonly expireRideOfferService: ExpireRideOfferService,
        private readonly logger: WorkflowLogger = workflowLogger
    ) {}

    execute(rideId: string): RideOffer | null {
        const ride = this.rideRepository.findById(rideId);
        if (!ride) {
            this.logger.log("error", "ride.dispatch.not_found", { rideId });
            throw new Error("Ride does not exist");
        }
        this.logger.log("info", "ride.dispatch.started", {
            rideId,
            status: ride.status
        });

        if (ride.status === "DRIVER_ASSIGNED") {
            const pendingOffer = this.rideOfferRepository.findByRideId(rideId)
                .find((offer) => offer.status === "PENDING");
            if (pendingOffer) {
                const expired = this.expireRideOfferService.execute(
                    rideId,
                    pendingOffer.id
                );
                if (!expired) {
                    this.logger.log("info", "ride.dispatch.pending_offer_exists", {
                        rideId,
                        driverId: pendingOffer.driverId,
                        offerId: pendingOffer.id
                    });
                    return pendingOffer;
                }
            }
        }

        if (ride.status === "REQUESTED") {
            ride.transitionTo("MATCHING");
            this.rideRepository.save(ride);
        } else if (ride.status !== "MATCHING") {
            throw new Error("Ride cannot be dispatched in its current state");
        }

        const previousOffers = this.rideOfferRepository.findByRideId(rideId);
        const excludedDriverIds = new Set(previousOffers.map((offer) => offer.driverId));

        while (true) {
            const driver = this.matchDriverService.execute(
                ride.pickup,
                [...excludedDriverIds]
            );
            if (!driver) {
                this.logger.log("info", "ride.dispatch.no_candidate", {
                    rideId,
                    status: ride.status,
                    excludedDriverIds: [...excludedDriverIds]
                });
                return null;
            }

            try {
                const offer = this.createRideOfferService.execute(rideId, driver.id);
                this.logger.log("info", "ride.dispatch.offer_created", {
                    rideId,
                    driverId: driver.id,
                    offerId: offer.id
                });
                return offer;
            } catch (error) {
                if (!(error instanceof DriverNotAvailableError)) {
                    this.logger.log("error", "ride.dispatch.failed", {
                        rideId,
                        driverId: driver.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    throw error;
                }
                this.logger.log("info", "ride.dispatch.claim_lost", {
                    rideId,
                    driverId: driver.id
                });
                excludedDriverIds.add(driver.id);
            }
        }
    }
}
