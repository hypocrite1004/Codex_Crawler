# P4. Crawler Observability and Usability Plan

## Goal

The main product risk is not general UI polish. The crawler must fetch accurately, persist predictably, and explain failures clearly enough for an operator to act without reading server logs first.

This phase improves crawler observability around three questions:

- Did the crawler run?
- What exactly happened during the run?
- What was stored, skipped, duplicated, filtered, or failed?

## Current Baseline

The backend already has the right raw data model:

- `CrawlerSource` stores source health, schedule, retry, and last failure state.
- `CrawlerLog` stores compact historical run summaries.
- `CrawlRun` stores execution-level totals.
- `CrawlItem` stores item-level outcomes and payloads.

The admin crawler page already shows source cards, health badges, last run metadata, and compact logs. The main gap is depth: operators cannot easily drill from a source to a run and from a run to item-level outcomes.

## P4-1. Crawler Operations Dashboard Refresh

Status: planned

Objective:
- Make the admin crawler page useful as an operations console, not only a source list.

Scope:
- Add stronger top-level summary metrics.
- Highlight sources requiring attention.
- Add filters for health, source type, active state, and search text.
- Sort sources by attention priority, due status, and latest run time.

Acceptance criteria:
- An admin can identify broken or stale sources within one screen.
- Sources with recent failures, auto-disabled state, or overdue runs are visually prioritized.
- Existing source CRUD and manual run behavior remains intact.

## P4-2. Crawl Run Detail Drilldown

Status: completed

Objective:
- Let an admin inspect an execution record without guessing from a toast or compact log row.

Scope:
- Added frontend API functions for crawler runs and run items.
- Added a run detail panel on the crawler page.
- Shows run status, trigger, duration, attempts, found, created, duplicate, filtered, error counts.
- Shows item-level outcomes grouped by `created`, `duplicate`, `filtered`, and `error`.

Acceptance criteria:
- Completed: after manual crawl, the operator can open the latest run directly when `run_id` is returned.
- Completed: failed runs and failed items have visible error messages when available.
- Completed: created items link to the generated post when `post_id` exists.

Implementation record:
- [p4-2-crawl-run-drilldown-implementation.md](/C:/project/Codex/Crawler/docs/p4-2-crawl-run-drilldown-implementation.md)

## P4-3. Crawler Result Diagnostics

Status: planned

Objective:
- Make failed or suspicious collection results actionable.

Scope:
- Normalize user-facing error categories where possible.
- Preserve detailed errors in admin-only run/item views.
- Surface common causes:
  - blocked source configuration
  - network/fetch failure
  - selector mismatch
  - missing URL
  - duplicate URL
  - item persistence error

Acceptance criteria:
- Operators can distinguish between "site unreachable", "selector extracted zero usable items", and "items existed but were filtered or duplicated".
- Backend tests cover at least the main error category mappings.

## P4-4. Collection Status Metrics

Status: planned

Objective:
- Show whether collection is healthy over time.

Scope:
- Add or reuse API data for recent run totals by status.
- Show 24h/7d collection summaries:
  - runs
  - successful runs
  - failed runs
  - created posts
  - duplicates
  - filtered items
  - item errors
- Keep the initial implementation admin-only.

Acceptance criteria:
- Admin can see whether the crawler is collecting more, less, or failing more than usual.
- Metrics are derived from `CrawlRun` and `CrawlItem`, not inferred from posts alone.

## P4-5. E2E Coverage for Crawler Operations

Status: planned

Objective:
- Lock the new operator flow with browser-level regression coverage.

Scope:
- Seed crawler source and run/item data.
- Verify source filters and attention states.
- Verify run detail drilldown.
- Verify created item link behavior.

Acceptance criteria:
- `npm run test:e2e` includes crawler operations coverage.
- Existing E2E tests remain passing.

## Recommended Order

1. `P4-2 Crawl Run Detail Drilldown`
2. `P4-1 Crawler Operations Dashboard Refresh`
3. `P4-3 Crawler Result Diagnostics`
4. `P4-4 Collection Status Metrics`
5. `P4-5 E2E Coverage for Crawler Operations`

Reasoning:
- The run/item API already exists, so drilldown has high value with low backend risk.
- Once detail is visible, the source list can link to real operational evidence.
- Error categorization and metrics should build on the same run/item vocabulary.
