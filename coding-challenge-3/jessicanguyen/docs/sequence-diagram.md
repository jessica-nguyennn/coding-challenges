# Ride creation and asynchronous dispatch

The ride creation endpoint does not wait for matching. Publishing enqueues the
event; a separate polling consumer handles it. The API initially returns the
ride in `REQUESTED`, and clients observe the eventual dispatch state by
refreshing the ride.

```mermaid
sequenceDiagram
    actor Passenger
    participant API as Express API
    participant Create as CreateRideService
    participant Rides as In-memory RideRepository
    participant Bus as InMemoryEventBus
    participant Consumer as Polling consumer
    participant Handler as RideCreatedHandler
    participant Dispatch as DispatchRideService
    participant Matcher as MatchDriverService
    participant Offer as CreateRideOfferService
    participant Drivers as In-memory DriverRepository
    participant Offers as In-memory RideOfferRepository

    Passenger->>API: POST /rides + Idempotency-Key
    API->>Create: execute(request, key)
    Create->>Rides: save(ride)
    Create->>Bus: publish(RideCreated)
    Note over Bus: Enqueue only; do not invoke handler
    Create-->>API: ride (REQUESTED)
    API-->>Passenger: 201 Created

    loop Consumer poll
        Consumer->>Bus: consumeNext(handler)
        Bus->>Handler: handle(RideCreated)
        Handler->>Dispatch: execute(rideId)
        Dispatch->>Matcher: execute(pickup, excludedDriverIds)
        Matcher->>Drivers: find available drivers
        Drivers-->>Matcher: candidates
        Matcher-->>Dispatch: nearest candidate or none
        alt Driver selected
            Dispatch->>Offer: execute(rideId, driverId)
            Offer->>Drivers: claimForOffer(driverId)
            Drivers-->>Offer: claimed driver or claim lost
            Offer->>Rides: save assigned ride
            Offer->>Offers: save pending offer
        else No eligible driver
            Note over Dispatch: Ride remains MATCHING
        end
        Handler-->>Bus: processed or error
    end
```

On handler failure, the event bus requeues the event until the configured
three-attempt limit. After that it stores an in-memory dead letter and the
consumer logs the failure. Duplicate event IDs are ignored by the handler
within the process. Queue state and deduplication do not persist across a
restart.
