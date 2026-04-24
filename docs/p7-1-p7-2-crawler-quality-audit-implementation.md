# P7-1 ~ P7-2 Crawler Quality Audit Implementation

Date: 2026-04-24

## Scope

- Added reusable crawler post quality checks in `backend/api/crawler_quality.py`.
- Added read-only management command `audit_crawler_quality`.
- Added backend tests for quality finding output and `--fail-on-error` behavior.
- Adjusted E2E seed crawler-linked content so the default audit baseline is clean.
- Added P7 plan and TODO status documentation.

## Command

```powershell
.\venv\Scripts\python.exe backend\manage.py audit_crawler_quality --days 7
```

Useful options:

- `--days N`: audit crawler-created posts created in the last N days.
- `--limit N`: limit printed affected posts.
- `--format json`: emit machine-readable output.
- `--fail-on-error`: return non-zero when error-severity issues exist.
- `--include-source-url-only`: include posts that have a `source_url` but no `CrawlItem` evidence or `crawler-system` author.

## Quality Findings

Error:
- `missing_title`
- `missing_content`
- `missing_source_url`

Warning:
- `short_content`
- `missing_normalized_source_url`
- `normalized_source_url_mismatch`

Info:
- `missing_published_at`
- `missing_security_context`

## Data Safety

The audit is read-only. It does not modify posts, crawl runs, crawl items, or crawler sources. By default it targets posts with `CrawlItem` evidence or the `crawler-system` author so ordinary editorial/E2E posts with a source URL do not pollute the crawler quality baseline.

## Verification

- Passed: `python -m py_compile backend/api/crawler_quality.py backend/api/management/commands/audit_crawler_quality.py backend/api/management/commands/seed_e2e_data.py backend/api/tests.py`
- Passed: `python backend/manage.py test api.tests.CrawlerQualityAuditTests --keepdb`
- Passed: `python backend/manage.py seed_e2e_data`
- Passed: `python backend/manage.py audit_crawler_quality --days 30 --limit 5`
- Passed: `python backend/manage.py check`
- Passed: `python backend/manage.py test api.tests --keepdb`
- Passed: `npm run lint`

## Next

- P7-3 should decide which findings become persistence guardrails.
- P7-4 should aggregate quality findings by source for operator dashboards.
