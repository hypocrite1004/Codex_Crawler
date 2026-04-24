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

Status: planned

Objective:
- Prevent avoidable low-quality crawler outputs from being stored as normal published posts.

Candidate scope:
- Decide which audit findings should block persistence versus only warn.
- Consider filtering empty content and missing URL at the fetch/persistence boundary.
- Consider preserving low-quality items as `CrawlItem(filtered/error)` evidence instead of published posts.

## P7-4. Source-Level Quality Metrics

Status: planned

Objective:
- Show which crawler sources are producing low-quality output over time.

Candidate scope:
- Aggregate quality issue counts by source/site.
- Add admin-only quality metrics to crawler operations.
- Identify sources with repeated short content, missing date, or enrichment gaps.

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
