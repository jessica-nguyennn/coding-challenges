# ADR-001: Nearest-driver matching


## Context

When a ride enters dispatch, the service needs to choose an eligible nearby
driver. Matching should be deterministic, exclude drivers that are not
available or have already received an offer for this ride, and avoid embedding
selection rules in ride or offer state-transition code.

## Decision

`MatchDriverService` selects the nearest eligible driver using the Haversine
distance between the ride pickup and each driver's latest known location. The
default maximum radius is 2 km and can be overridden when constructing the
service.

Only drivers with `AVAILABLE` status and a known location are considered.
Drivers outside the configured radius and IDs passed through
`excludedDriverIds` are omitted. Equal calculated distances are ordered by
ascending `driverId`, making the selection deterministic. If no eligible
driver exists, the service returns `null`.

`DispatchRideService` supplies driver IDs from previous offers as exclusions,
then asks `CreateRideOfferService` to claim the selected driver and create the
offer. If the atomic claim loses due to concurrent dispatch, dispatch excludes
that candidate for the current attempt and tries the next match.

## Consequences

- Matching is isolated and reusable; it chooses a driver but does not mutate
  ride, driver, or offer state.
- The default radius is simple for the challenge and configurable for tests or
  future policy changes.
- The current implementation scans all in-memory drivers and sorts eligible
  candidates, so its work grows with the number of drivers.
- At larger scale, a geospatial index or location-aware database query can
  narrow candidates before calculating exact distances, while preserving the
  same eligibility, radius, and tie-breaking rules.
- Coordinates are validated by the shared `Location` domain model before
  matching.
