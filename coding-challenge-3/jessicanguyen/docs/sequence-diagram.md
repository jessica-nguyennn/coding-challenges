## 1. Create ride and asynchronous dispatch

The create endpoint does not wait for matching. Publishing only enqueues the
event; a separate polling consumer handles it. The API returns the ride in
`REQUESTED`, and the client sees the later state by reading the ride again.

```mermaid
sequenceDiagram
    actor Passenger
    participant API as Express API
    participant CreateRide as CreateRideService
    participant Rides as RideRepository
    participant Bus as EventBus
    participant Consumer as Polling consumer
    participant Handler as RideCreatedHandler
    participant Dispatch as DispatchRideService
    participant Matcher as MatchDriverService
    participant Offer as CreateRideOfferService
    participant Drivers as DriverRepository
    participant Offers as RideOfferRepository

    Passenger->>API: POST /rides with Idempotency-Key
    API->>CreateRide: execute(request, key)
    CreateRide->>CreateRide: validate passenger and coordinates
    CreateRide->>Rides: save(ride REQUESTED)
    CreateRide->>Bus: publish(RideCreated)
    CreateRide-->>API: ride (REQUESTED)
    API-->>Passenger: 201 Created

    Note over Bus,Consumer: Asynchronous from here on

    Consumer->>Bus: consumeNext(handler)
    Bus->>Handler: handle(RideCreated)
    Handler->>Dispatch: execute(rideId)
    Dispatch->>Rides: ride REQUESTED to MATCHING
    Dispatch->>Offers: find previous offers (excluded drivers)
    Dispatch->>Matcher: execute(pickup, excludedDriverIds)
    Matcher->>Drivers: findAll()
    Note over Matcher: Keep AVAILABLE drivers with a location,<br/>within radius, sort by distance then driverId
    Matcher-->>Dispatch: nearest driver or none

    alt a driver was selected
        Dispatch->>Offer: execute(rideId, driverId)
        Offer->>Drivers: claimForOffer(driverId)
        Drivers-->>Offer: driver now OFFERED
        Offer->>Rides: ride to DRIVER_ASSIGNED, set assignedDriverId
        Offer->>Offers: save(offer PENDING, expires in 30s)
        Note over Offer: Starts the expiry timer (flow 4)
    else no eligible driver
        Note over Dispatch: Ride stays MATCHING, no assignedDriverId
    end
    Handler-->>Bus: processed
```

**Why asynchronous.** Creation stays fast and independent of matching latency,
and dispatch can be retried without the caller re-sending anything. The cost is
eventual consistency.

**If processing fails.** The handler throws, the bus requeues the event, and
after three attempts it moves the event to an in-memory dead-letter list and
logs it. The ride remains `REQUESTED`, and `POST /rides/:rideId/dispatch`
retries it manually.

---

## 2. Duplicate requests and duplicate events

Idempotency is applied at the API edge and again at the event handler.

```mermaid
sequenceDiagram
    actor Client
    participant API as Express API
    participant CreateRide as CreateRideService
    participant Bus as EventBus
    participant Handler as RideCreatedHandler
    participant Dispatch as DispatchRideService

    rect rgb(235, 245, 255)
    Note over Client,CreateRide: Duplicate HTTP request
    Client->>API: POST /rides, key K, body B
    API->>CreateRide: execute(B, K)
    CreateRide-->>Client: 201 ride R (created, event published)
    Client->>API: POST /rides, key K, body B (retry)
    API->>CreateRide: execute(B, K)
    CreateRide-->>Client: 201 same ride R (no new ride, no new event)
    Client->>API: POST /rides, key K, different body
    API->>CreateRide: execute(other, K)
    CreateRide-->>Client: 409 key already used with a different request
    end

    rect rgb(255, 245, 235)
    Note over Bus,Dispatch: Duplicate event delivery
    Bus->>Handler: handle(RideCreated, eventId E)
    Handler->>Dispatch: execute(rideId)
    Handler->>Handler: remember E as processed
    Bus->>Handler: handle(RideCreated, eventId E) again
    Handler->>Handler: E already processed, ignore
    end
```

The handler records an event ID only after dispatch succeeds. If dispatch
throws, the event is not marked processed, so a retry runs it again. Dispatch
is also safe when repeated: if the ride already has a pending offer that has
not expired, it returns that offer instead of creating another.

Both stores (idempotency records and processed event IDs) are in memory, so
they reset when the process restarts.

---

## 3. Driver rejects and the ride is rematched

```mermaid
sequenceDiagram
    actor D1 as Driver D001
    participant API as Express API
    participant Respond as RespondToRideOfferService
    participant Rides as RideRepository
    participant Drivers as DriverRepository
    participant Offers as RideOfferRepository
    participant Dispatch as DispatchRideService
    participant Offer as CreateRideOfferService

    D1->>API: POST /rides/R/offers/O1/reject (driverId D001)
    API->>Respond: reject(R, O1, D001)
    Respond->>Offers: load offer O1
    Respond->>Respond: check offer belongs to ride, driver matches, still PENDING, not expired
    Respond->>Offers: offer O1 to REJECTED
    Respond->>Rides: ride to MATCHING, clear assignedDriverId
    Respond->>Drivers: D001 OFFERED to AVAILABLE
    Respond->>Dispatch: execute(R)
    Dispatch->>Offers: previous offers = [O1], so exclude D001
    Dispatch->>Dispatch: match nearest AVAILABLE driver, excluding D001
    alt another eligible driver D002
        Dispatch->>Offer: execute(R, D002)
        Note over Offer: D002 claimed, ride DRIVER_ASSIGNED, offer O2 saved
    else none left
        Note over Dispatch: Ride stays MATCHING with no assignedDriverId
    end
    Respond-->>API: offer O1 (REJECTED)
    API-->>D1: 200
```



---

## 4. Offer times out

An expiry follows the same state transition as a rejection. There are two
independent triggers, so a missed timer never lets an expired offer be honored.

```mermaid
sequenceDiagram
    participant Offer as CreateRideOfferService
    participant Timer as Expiry timer
    participant Expire as ExpireRideOfferService
    participant Offers as RideOfferRepository
    participant Rides as RideRepository
    participant Drivers as DriverRepository
    participant Dispatch as DispatchRideService
    actor D as Driver

    Offer->>Timer: schedule at expiresAt (default 30s)

    alt driver does not respond in time
        Timer->>Expire: execute(R, O)
        Expire->>Offers: offer O to EXPIRED
        Expire->>Rides: ride DRIVER_ASSIGNED to MATCHING, clear assignedDriverId
        Expire->>Drivers: driver OFFERED to AVAILABLE
        Expire-->>Timer: expired
        Timer->>Dispatch: execute(R) to find the next driver
    else late response (timer not yet fired or lost)
        D->>Dispatch: accept or reject after expiresAt
        Note over D,Dispatch: Respond service sees now >= expiresAt,<br/>expires the offer, rematches, and answers with an error
    end
```

If a response arrives after the deadline, the offer is expired first and the
driver gets an error, never a late success. Timers are process-local and do not
survive a restart; the deadline check on the next request or dispatch still
catches an overdue offer.

---

## 5. Driver accepts, then the ride completes

```mermaid
sequenceDiagram
    actor Driver as Driver D002
    participant API as Express API
    participant Respond as RespondToRideOfferService
    participant Complete as CompleteRideService
    participant Rides as RideRepository
    participant Drivers as DriverRepository
    participant Offers as RideOfferRepository

    Driver->>API: POST /rides/R/offers/O2/accept (driverId D002)
    API->>Respond: accept(R, O2, D002)
    Respond->>Respond: only the offered driver, offer PENDING, not expired
    Respond->>Offers: offer O2 to ACCEPTED
    Respond->>Rides: ride to DRIVER_ACCEPTED
    Respond->>Drivers: D002 OFFERED to BUSY
    Respond-->>Driver: 200

    Driver->>API: POST /rides/R/offers/O2/accept (duplicate)
    API->>Respond: accept(R, O2, D002)
    Note over Respond: Offer already ACCEPTED, ride DRIVER_ACCEPTED,<br/>driver BUSY, so return success without changing anything
    Respond-->>Driver: 200

    Driver->>API: POST /rides/R/complete
    API->>Complete: execute(R)
    Complete->>Rides: ride to COMPLETED
    Complete->>Drivers: D002 BUSY to AVAILABLE
    Complete-->>Driver: 204
```

An accept from any other driver, for another ride's offer, or for an offer that
is no longer `PENDING` is rejected (403 or 409). Completing a ride that was
never accepted is rejected with 409, and completing an already completed ride
is a no-op.

---

## 6. Two rides compete for one driver

This is the race from AC-09. Matching reads a snapshot of drivers, so two
dispatchers can both choose the same driver from stale data. The decision is
made at the write, using an atomic compare-and-set.

```mermaid
sequenceDiagram
    participant A as Dispatch for ride R1
    participant B as Dispatch for ride R2
    participant Drivers as DriverRepository

    Note over A,B: Both matched D001 while it was AVAILABLE
    A->>Drivers: claimForOffer(D001)
    Drivers-->>A: claimed (AVAILABLE to OFFERED)
    B->>Drivers: claimForOffer(D001)
    Drivers-->>B: lost (D001 is no longer AVAILABLE)

    Note over A: Creates offer, R1 becomes DRIVER_ASSIGNED
    Note over B: DriverNotAvailableError, so exclude D001 for this attempt
    B->>B: match again among remaining drivers
    alt another eligible driver
        Note over B: Offer made to that driver
    else none
        Note over B: R2 stays MATCHING with no assignedDriverId
    end
```

In a single Node.js process the check and the status change happen in one
synchronous method, so they cannot interleave. With a database the same step is
one conditional update, and zero affected rows means the claim was lost:

```sql
UPDATE drivers SET status = 'OFFERED'
WHERE id = ? AND status = 'AVAILABLE';
```

