# P7. Crawler Accuracy and Content Quality Plan

## Goal

Make crawler output trustworthy enough that public discovery features are backed by accurate source URLs, usable content, dates, and security context.

## Product Direction

Priority:
- Crawler accuracy and stored content quality.
- Operator visibility is included where it helps identify bad collection results before they become public product issues.

Primary user:
- Admin/operator for detection and remediation.
- Public visitor as the downstream beneficiary of cleaner collected content.

Success criterion:
- Operators can repeatedly audit recent crawler-created posts and identify content-quality defects before public visitors rely on those posts.

## P7-1. Crawler Quality Contract

Status: completed

Objective:
- Define what "accurate enough to store" means for crawler-created posts.

Quality checks:
- Title is present and not a fallback placeholder.
- Content is non-empty after HTML stripping.
- Short content is flagged for review.
- Source URL is present.
- Normalized source URL is present and matches the current normalization rule.
- Published date is present when available.
- IOC or CVE context is present, or the post is flagged as an enrichment gap.

Acceptance criteria:
- Completed: crawler quality criteria are documented.
- Completed: criteria are implemented as a reusable audit function.

Implementation record:
- [p7-1-p7-2-crawler-quality-audit-implementation.md](/C:/project/Codex/Crawler/docs/p7-1-p7-2-crawler-quality-audit-implementation.md)

## P7-2. Recent Crawl Quality Audit

Status: completed

Objective:
- Give operators and future agents an executable way to inspect recent crawler-created post quality.

Scope:
- Added `audit_crawler_quality` management command.
- Supports recent lookback window, text output, JSON output, and `--fail-on-error`.
- Does not modify data.

Acceptance criteria:
- Completed: recent crawler-created posts can be audited from the CLI.
- Completed: error-severity audit findings can fail automation when requested.

Implementation record:
- [p7-1-p7-2-crawler-quality-audit-implementation.md](/C:/project/Codex/Crawler/docs/p7-1-p7-2-crawler-quality-audit-implementation.md)

## P7-3. Storage Quality Guardrails

Status: completed

Objective:
- Prevent avoidable low-quality crawler outputs from being stored as normal published posts.

Scope:
- Missing title and fallback placeholder title are filtered before post creation.
- Empty content after HTML stripping is filtered before post creation.
- Filtered low-quality items are preserved as `CrawlItem(filtered)` evidence.
- Warning-only audit findings remain non-blocking until source-level metrics and remediation thresholds exist.

Acceptance criteria:
- Completed: low-quality crawler items with missing title or empty content are not stored as posts.
- Completed: filtered item evidence is visible through crawl item records.
- Completed: duplicate URL detection still takes precedence over quality filtering.

Implementation record:
- [p7-3-storage-quality-guardrails-implementation.md](/C:/project/Codex/Crawler/docs/p7-3-storage-quality-guardrails-implementation.md)

## P7-4. Source-Level Quality Metrics

Status: completed

Objective:
- Show which crawler sources are producing low-quality output over time.

Scope:
- Aggregate recent quality issue counts by crawler source.
- Include source quality summaries in the admin-only crawler metrics endpoint.
- Surface quality error/warning alerts alongside existing reliability alerts.
- Display source quality status in the admin crawler dashboard.

Acceptance criteria:
- Completed: source rows show recent quality status and issue counts.
- Completed: quality findings use the same audit contract as `audit_crawler_quality`.
- Completed: sources with quality errors or warnings are included in operator alerts.

Implementation record:
- [p7-4-source-quality-metrics-implementation.md](/C:/project/Codex/Crawler/docs/p7-4-source-quality-metrics-implementation.md)

## P7-5. Remediation Flow

Status: planned

Objective:
- Let operators act on quality findings.

Candidate scope:
- Re-run source or item.
- Mark a source as needs selector review.
- Link affected posts/items from the quality report to admin surfaces.

## Verification

- `python -m py_compile backend/api/crawler_quality.py backend/api/management/commands/audit_crawler_quality.py backend/api/management/commands/seed_e2e_data.py backend/api/tests.py`
- `python backend/manage.py test api.tests.CrawlerQualityAuditTests --keepdb`
- `python backend/manage.py seed_e2e_data`
- `python backend/manage.py audit_crawler_quality --days 30 --limit 5`
- `python backend/manage.py check`
- `python backend/manage.py test api.tests --keepdb`
- `npm run lint`
- `python -m py_compile backend/api/crawler_persistence.py backend/api/crawler_diagnostics.py backend/api/tests.py`
- `python backend/manage.py test api.tests.CrawlRunTrackingTests.test_low_quality_items_are_filtered_before_post_creation --keepdb`
- `python backend/manage.py test api.tests.CrawlRunTrackingTests api.tests.CrawlerQualityAuditTests --keepdb`
- `npm run lint` from `frontend/`
- `python -m py_compile backend/api/crawler_quality.py backend/api/crawler_views.py backend/api/tests.py`
- `python backend/manage.py test api.tests.CrawlRunTrackingTests.test_crawler_metrics_endpoint_returns_source_quality_summaries api.tests.CrawlRunTrackingTests.test_crawler_metrics_endpoint_returns_period_and_source_summaries --keepdb`
- `npm run build` from `frontend/`
