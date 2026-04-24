# P5. Crawler Reliability Hardening Plan

## Goal

Improve crawler stability so collection can recover from failed executions, preserve consistent evidence, and alert operators before silent data loss or stale state becomes a product issue.

## P5-1. Execution Lock and State Recovery

Status: completed

Objective:
- Prevent stale `is_running` locks and `running` crawl runs from blocking future collection indefinitely.

Scope:
- Added stale crawler run timeout setting.
- Added recovery for locked sources whose run started before the stale timeout.
- Converts stuck `CrawlRun` records to `error` with a recovery message.
- Writes an operator-visible `CrawlerLog` recovery record.
- Scheduler runs recovery before due-source checks.

Acceptance criteria:
- Completed: a fresh running source still blocks duplicate crawl execution.
- Completed: a stale running source can be recovered before a new manual run.
- Completed: scheduler recovers stale locks and avoids immediate retry loops in the same tick.

Implementation record:
- [p5-1-crawler-lock-state-recovery-implementation.md](/C:/project/Codex/Crawler/docs/p5-1-crawler-lock-state-recovery-implementation.md)

## P5-2. Persistence Consistency Guardrails

Status: completed

Objective:
- Ensure run summary counts remain aligned with actual `CrawlItem` evidence when item processing partially fails.

Scope:
- Added consistency checks for `articles_created`, `duplicate_count`, `filtered_count`, and `error_count`.
- Expanded tests around partial item evidence recording failures.
- Kept item-level evidence as the source of truth for run summaries.

Acceptance criteria:
- Completed: run summary counts are derived from recorded `CrawlItem` evidence.
- Completed: duplicate item recording failure does not leave duplicate counts without duplicate evidence.
- Completed: missing URL item handling uses the same per-item exception boundary as other outcomes.

Implementation record:
- [p5-2-crawler-persistence-consistency-implementation.md](/C:/project/Codex/Crawler/docs/p5-2-crawler-persistence-consistency-implementation.md)

## P5-3. Retry and Auto-disable Policy Hardening

Status: completed

Objective:
- Make retry behavior safer by treating transient network failures differently from deterministic configuration/selector failures.

Scope:
- Clarified retryable vs non-retryable diagnostics.
- Avoided repeated retries for deterministic selector/configuration-like failures.
- Preserved scheduled crawl single-attempt behavior.

Acceptance criteria:
- Completed: network/unclassified errors remain retryable for manual runs.
- Completed: selector mismatch errors do not retry.
- Completed: scheduled crawls remain single-attempt.

Implementation record:
- [p5-3-crawler-retry-policy-implementation.md](/C:/project/Codex/Crawler/docs/p5-3-crawler-retry-policy-implementation.md)

## P5-4. Operator Reliability Alerts

Status: planned

Objective:
- Surface reliability warnings before operators need to inspect individual runs.

Scope:
- Flag long-running stale candidates.
- Flag high recent failure rate.
- Flag sources with no successful run over a configured window.
- Flag high item error rate.

## P5-5. Reliability Test Expansion

Status: planned

Objective:
- Lock the reliability behavior with backend integration tests and focused E2E checks where UI behavior changes.

Scope:
- Add stale lock recovery tests.
- Add run count consistency tests.
- Add retry/auto-disable policy tests.
- Add alert visibility E2E if P5-4 changes UI.
