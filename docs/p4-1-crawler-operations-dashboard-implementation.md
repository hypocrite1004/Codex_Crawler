# P4-1. Crawler Operations Dashboard Implementation

## Status

Completed on 2026-04-24.

## Objective

Make the admin crawler page work as an operations console. Operators should be able to identify sources that need attention, find a specific source quickly, and narrow the list without reading every source card.

## Changes

- Added stronger top-level source metrics:
  - total
  - active
  - running
  - due now
  - healthy
  - failed
  - paused
  - attention
- Added client-side source filters:
  - search by name, URL, or category
  - health filter
  - scheduler active/paused filter
  - source type filter
- Added source sorting:
  - attention first
  - due first
  - latest run
  - name
- Added filtered result count and empty filtered state.
- Added reset control for all source filters.
- Added E2E coverage for filtering by search, health, source type, scheduler state, no-match state, and reset.

## Operator Outcome

An admin can now:

- see how many sources are due, failed, paused, healthy, or running
- narrow source cards to the source they need
- isolate sources needing attention
- reset operational filters in one action

## Verification

- `.\venv\Scripts\python.exe backend\manage.py check`
- `.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

Result:
- Backend check passed.
- Backend tests passed: 48 tests.
- Frontend lint passed.
- Frontend build passed.
- Playwright E2E passed: 8 tests.
