# P7-3. Storage Quality Guardrails Implementation

## Summary

Crawler persistence now blocks deterministically unusable items before they become published posts.

Blocked items:
- Missing title.
- Fallback placeholder title.
- Empty content after HTML stripping.

Blocked items are preserved as `CrawlItem(filtered)` records with explicit error messages instead of being silently discarded. Duplicate URL detection still runs before the content-quality guardrail, so duplicate evidence remains categorized as duplicate rather than low quality.

## Decisions

- Missing title and missing content are storage blockers because they create unusable public posts.
- Short content, missing published date, missing security context, and normalized URL quality remain audit findings only. These can produce legitimate false positives until source-level thresholds and remediation flows exist.
- Missing title/content diagnostics map to selector or parsing mismatch because the likely remediation is source parser or selector review.

## Verification

- Passed: `python -m py_compile backend/api/crawler_persistence.py backend/api/crawler_diagnostics.py backend/api/tests.py`
- Passed: `python backend/manage.py test api.tests.CrawlRunTrackingTests.test_low_quality_items_are_filtered_before_post_creation --keepdb`
- Passed: `python backend/manage.py test api.tests.CrawlRunTrackingTests api.tests.CrawlerQualityAuditTests --keepdb`
- Passed: `python backend/manage.py check`
- Passed: `python backend/manage.py audit_crawler_quality --days 30 --limit 5`
- Passed: `python backend/manage.py test api.tests --keepdb`
- Passed: `npm run lint` from `frontend/`
- Not run: live external crawler fetch.
