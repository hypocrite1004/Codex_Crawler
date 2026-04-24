# P6-1. Public Post List Discovery UX Implementation

## Status

Completed on 2026-04-24.

## Objective

Help public visitors identify posts with richer security context directly from the public feed, without opening every article first.

## Changes

- Added public-safe discovery fields to post list API responses:
  - `published_at`
  - `ioc_count`
- Added `has_security_context=true` public post list filter.
- Added `ordering=security_context` to prioritize CVE-linked, related, summarized, shared, and recent posts.
- Added a public feed filter checkbox for `보안 맥락 포함`.
- Added security context chips on public post cards:
  - summary availability
  - IOC count
  - related post count
- Added a concise card signal line such as `Security context: 1 CVE · summary`.
- Kept internal crawler diagnostics out of public responses.

## User Outcome

Public visitors can now narrow the feed to posts that have security enrichment and quickly identify whether a post has CVE, IOC, summary, or related coverage signals.

## Verification

- `.\venv\Scripts\python.exe backend\manage.py test api.tests.CveFeatureTests.test_public_post_list_exposes_discovery_signals_and_context_filter --keepdb`
- `npm run lint`

Result:
- Targeted backend API test passed.
- Frontend lint passed.
