# Ride-Hailing Dispatch Demo

A TypeScript and Express modular monolith demonstrating ride creation, driver
availability and location, nearest-driver matching, ride offers, and
event-driven dispatch. It uses in-memory repositories and an in-memory event
bus so the workflow can be run locally without external infrastructure.

## Run the application

From the repository root, enter the application directory, install dependencies,
and start the development server:

```sh
cd coding-challenge-3/jessicanguyen
npm install
npm run dev
```

For a production-style local run, build first and then start the compiled
server:

```sh
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) for the demo dashboard.
The in-memory repositories contain passenger `P001` and drivers `D001`, `D002`,
and `D003`. Drivers start `OFFLINE`; mark a driver `AVAILABLE` and set a
location before requesting a ride. Data resets when the process restarts.

The API listens on port `3000`. Important operations:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/rides` | Create a ride; requires `Idempotency-Key` |
| `GET` | `/rides` | List rides |
| `GET` | `/rides/:rideId/offers` | List a ride's offer history |
| `POST` | `/rides/:rideId/dispatch` | Retry dispatch for a matching ride |
| `POST` | `/rides/:rideId/offers` | Create an offer for the specified driver |
| `POST` | `/rides/:rideId/offers/:offerId/accept` | Accept an offer; body contains `driverId` |
| `POST` | `/rides/:rideId/offers/:offerId/reject` | Reject an offer; body contains `driverId` |
| `POST` | `/rides/:rideId/cancel` | Cancel a ride |
| `POST` | `/rides/:rideId/complete` | Complete an accepted ride |
| `GET` | `/drivers` | List drivers |
| `PUT` | `/drivers/:driverId/availability` | Set `OFFLINE` or `AVAILABLE` |
| `PUT` | `/drivers/:driverId/location` | Update validated coordinates |

Example ride request:

```sh
curl -X POST http://localhost:3000/rides \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-ride-001' \
  -d '{
    "passengerId": "P001",
    "pickup": { "latitude": 10.7769, "longitude": 106.7009 },
    "destination": { "latitude": 10.8231, "longitude": 106.6297 }
  }'
```

## Run tests

```sh
npm test
npm run build
```

`npm test` runs the Vitest suite. `npm run build` runs the TypeScript compiler
and verifies the project type-checks. The tests cover domain rules, application
services, HTTP routes, the event bus, and asynchronous ride dispatch.

## Architecture

The application is a modular monolith with Express routes at the edge,
application services coordinating use cases, domain entities enforcing
invariants, and repository ports implemented by in-memory adapters. The
`RideCreated` event separates ride creation from dispatch processing. The
dashboard is static content served by Express and calls the same HTTP API as
other clients.

See [docs/architecture.md](docs/architecture.md) for a component diagram and
[docs/sequence-diagram.md](docs/sequence-diagram.md) for the create-and-dispatch
flow.

## Matching strategy

`MatchDriverService` scans drivers with `AVAILABLE` status and a known latest
location, computes Haversine distance from the ride pickup, filters to the
configurable radius (2 km by default), then chooses the nearest. Equal
calculated distances are ordered by ascending driver ID. Prior offer recipients
for the same ride are excluded. If no eligible driver exists, dispatch leaves
the ride in `MATCHING` without an assigned driver.

See [ADR-001: Nearest-driver matching](docs/adr/ADR-001-matching.md).

## Concurrency strategy

Offer creation calls `DriverRepository.claimForOffer(driverId)`, which changes a
driver from `AVAILABLE` to `OFFERED` only if the driver is still available.
This compare-and-set claim prevents two dispatch attempts from assigning the
same driver based on stale matching results. A failed claim is skipped while
dispatch tries another candidate.

The current in-memory check-and-transition is atomic only inside one Node.js
process. A multi-process database implementation must use a conditional update
(`WHERE status = 'AVAILABLE'`) and treat zero affected rows as a lost claim.
The driver claim and ride/offer writes are not transactional as a group today.
See [ADR-002: Atomic driver offer claims](docs/adr/ADR-002-concurrency.md).

## Idempotency strategy

Ride creation requires an `Idempotency-Key`. `CreateRideService` keeps a
key-to-request-fingerprint-and-ride map: the same key and payload return the
original ride without another save or event; reusing the key with a different
payload is rejected. The `RideCreated` event ID is the ride ID, and
`RideCreatedHandler` tracks processed event IDs for the lifetime of the process.
The handler and dispatch path also tolerate duplicate delivery while a pending
offer already exists.

This state is in memory, so idempotency records and processed-event IDs do not
survive process restart or coordinate across instances.

## Event-driven dispatch

After saving a new ride, `CreateRideService` publishes a `RideCreated` event to
`InMemoryEventBus`. `publish()` only enqueues; a separate polling consumer
passes queued events to `RideCreatedHandler`, which delegates to
`DispatchRideService`. Ride creation therefore responds without waiting for
matching; the response starts in `REQUESTED`, and the dashboard polls for the
eventual state.

The bus provides at-least-once processing within the running process. Handler
failures are retried up to three total attempts. After the last failure, the
event is moved to an in-memory dead-letter collection and logged. A user can
retry dispatch from the dashboard, but there is currently no dead-letter
replay interface.

Asynchronous processing keeps ride creation independent of dispatch latency
and lets dispatch be retried separately. For production durability, use an
outbox or transactional messaging strategy so ride persistence and event
publication cannot silently diverge.

## Observability

The application writes one-line JSON workflow records to stdout (`info`) and
stderr (`error`). Records include an ISO timestamp, an event name, and available
correlation fields such as `rideId`, `driverId`, `offerId`, and `eventId`.
Lifecycle entries cover ride creation, event publication/consumption, dispatch
start and result, offer creation/acceptance/rejection/expiration, and ride
cancellation/completion. Consumer retries and dead-letter outcomes include
the event ID and attempt count.

To investigate a ride, search the application output for its exact `rideId`;
follow the associated `eventId`, `offerId`, and `driverId` fields across the
creation, dispatch, and lifecycle records. For example, with JSON logs captured
in `app.log`:

```sh
grep '"rideId":"R001"' app.log
```

Logs are process output only: this demo does not persist, index, or retain them
centrally, and does not yet include metrics or distributed tracing.

## Scalability considerations

The demo is intentionally sized for a local challenge. Likely bottlenecks and
evolution paths:

| Bottleneck | Scaling strategy |
|---|---|
| Full in-memory driver scan and sort on each match | Use a geospatial index or database query to shortlist nearby available drivers |
| Single-process in-memory state and event queue | Move rides, drivers, offers, and idempotency records to a database; use a durable broker/outbox |
| Single polling consumer and sequential event handling | Run horizontally scaled consumers with partitioning, backpressure, and per-driver atomic claims |

These choices involve trade-offs. A geospatial index adds write/index complexity
but reduces matching work. Durable infrastructure improves recovery and
multi-instance correctness but increases operational cost and latency. A
synchronous ride response is simpler, while asynchronous dispatch reduces API
latency but means clients observe eventual consistency.

## Known limitations

- All application data, event queue state, retries, deduplication records, and
  dead letters are process-local and lost on restart.
- The database write and event publish are not atomic; process failure between
  them can leave a ride without a dispatch event.
- The driver claim is not a distributed lock or cross-process atomic update.
- The dashboard/API use seeded identities and do not implement authentication
  or authorization.
- Offer expiration uses process-local timers; timers do not survive restart.
- Dead letters are logged and retained in memory, but cannot currently be
  inspected or replayed through an API.
- The API provides demonstration operations, not production-grade validation,
  centralized observability, persistence, or rate limiting.
