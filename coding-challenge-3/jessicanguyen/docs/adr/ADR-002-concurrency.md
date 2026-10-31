# ADR-002: Atomic driver offer claims

## Context

Two dispatch workers can read the same driver as `AVAILABLE` and both select
that driver for different rides. A read followed by a normal save is not
sufficient to prevent the driver from holding two offers.

## Decision

Offer creation uses `DriverRepository.claimForOffer(driverId)` as a
compare-and-set operation. It changes the driver from `AVAILABLE` to `OFFERED`
only if the stored status is still `AVAILABLE`. A failed claim returns no
driver and creates no offer. Dispatch excludes that failed candidate for the
current attempt and tries another candidate; if none is available, the ride
remains `MATCHING`.

The in-memory repository performs the check and state change synchronously
within one method. A database-backed implementation must use one conditional
write, for example:

```sql
UPDATE drivers
SET status = 'OFFERED'
WHERE id = ? AND status = 'AVAILABLE'
RETURNING id, status, latitude, longitude;
```

Zero returned rows means another dispatcher won the claim.

## Consequences

- One driver cannot be offered to two rides based on stale matching results.
- Matching remains separate from the atomic claim; dispatch coordinates retry.
- The in-memory implementation is suitable for this single-process demo. A
  multi-process deployment must implement the conditional database update.
- Claiming the driver and persisting the ride and offer are not one transaction
  in this in-memory implementation. A persistent implementation should group
  those writes in a transaction or use a recoverable workflow.
