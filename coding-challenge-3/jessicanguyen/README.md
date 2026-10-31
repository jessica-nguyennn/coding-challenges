# Ride-Hailing Dispatch Demo

A TypeScript/Express modular-monolith demo for ride creation, driver matching,
ride offers, and asynchronous dispatch.

## Run

From this directory:

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the demo dashboard.
The dashboard seeds no users itself; passenger `P001` and drivers `D001`–`D003`
are available as in-memory demo records. Set a driver to `AVAILABLE` and give
them a location before requesting a ride to see matching.

Run the TypeScript build and tests with:

```sh
npm run build
npm test
```

## Event-driven dispatch (AC-10)

`CreateRideService` saves the ride and publishes a `RideCreated` event containing
an event ID and ride ID. Publishing only appends to `InMemoryEventBus`; it does
not invoke the handler. A separate polling consumer takes queued events and
passes them to `RideCreatedHandler`, which delegates dispatch to
`DispatchRideService`. Consequently, the create endpoint returns the ride in
`REQUESTED` without waiting for matching. The dashboard refreshes periodically
to show the later state.

The in-memory bus permits at-least-once delivery. The handler tracks processed
event IDs for the lifetime of the process, and dispatch is also safe to repeat
while an offer is pending. A handler failure is retried up to three total
attempts; after that, the event is kept in an in-memory dead-letter collection
and reported to the application log. A later manual dispatch retry is available
from the dashboard.

This bus is intentionally a demo implementation: its queue, retry counts,
processed event IDs, and dead letters are lost on process restart. Ride saving
and event publication are not transactionally coupled. A durable deployment
should use an outbox with a persistent broker/queue and durable consumer
deduplication, and should monitor and support replaying dead-letter events.
