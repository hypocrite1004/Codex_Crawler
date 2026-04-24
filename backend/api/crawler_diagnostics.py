DIAGNOSTICS = {
    'ok': {
        'label': 'No issue detected',
        'hint': 'The crawler finished without recorded errors.',
    },
    'running': {
        'label': 'Run in progress',
        'hint': 'The source is currently locked by an active crawler run.',
    },
    'fallback': {
        'label': 'Fallback fetch used',
        'hint': 'The crawler succeeded through the fallback fetch path. Review selectors if this becomes frequent.',
    },
    'partial_item_errors': {
        'label': 'Partial item failures',
        'hint': 'The run completed, but one or more items failed during persistence or item recording.',
    },
    'blocked_source': {
        'label': 'Blocked source configuration',
        'hint': 'The source URL or request headers were rejected by crawler security rules.',
    },
    'network_error': {
        'label': 'Network or fetch failure',
        'hint': 'Check reachability, DNS, TLS, rate limits, and upstream availability.',
    },
    'selector_mismatch': {
        'label': 'Selector or parsing mismatch',
        'hint': 'The source may have changed markup, or configured selectors no longer match usable article elements.',
    },
    'missing_url': {
        'label': 'Missing item URL',
        'hint': 'The crawler found an item without a usable source URL. Review link selectors or feed item links.',
    },
    'duplicate_url': {
        'label': 'Duplicate URL',
        'hint': 'The item maps to an existing post by source URL or normalized URL.',
    },
    'persistence_error': {
        'label': 'Persistence failure',
        'hint': 'The item was fetched but could not be stored or linked to its crawl record.',
    },
    'auto_disabled': {
        'label': 'Source auto-disabled',
        'hint': 'The source reached its configured failure threshold and scheduler collection was disabled.',
    },
    'unknown_error': {
        'label': 'Unclassified crawler error',
        'hint': 'Review the raw run or item error message for the concrete failure.',
    },
}


def diagnostic_detail(category: str) -> dict:
    detail = DIAGNOSTICS.get(category, DIAGNOSTICS['unknown_error'])
    return {
        'diagnostic_category': category,
        'diagnostic_label': detail['label'],
        'diagnostic_hint': detail['hint'],
    }


def categorize_error(message: str) -> str:
    text = (message or '').lower()
    if not text:
        return 'ok'
    if 'auto-disabled' in text or 'auto disabled' in text:
        return 'auto_disabled'
    if 'blocked crawler source' in text or 'non-public network' in text or 'not allowed' in text:
        return 'blocked_source'
    if any(term in text for term in ['timeout', 'connection', 'refused', 'unavailable', 'socket', 'dns', 'tls', 'ssl', 'dial tcp', 'fetch failed']):
        return 'network_error'
    if any(term in text for term in ['selector', 'parse', 'no item', 'no article', 'article list', 'link selector']):
        return 'selector_mismatch'
    if 'missing source url' in text or 'missing url' in text:
        return 'missing_url'
    if 'duplicate source url' in text or 'duplicate key' in text:
        return 'duplicate_url'
    if any(term in text for term in ['persist', 'persistence', 'database', 'record failed', 'write failed', 'integrity', 'save failed']):
        return 'persistence_error'
    return 'unknown_error'


def is_retryable_crawler_error(message: str) -> bool:
    return categorize_error(message) in {'network_error', 'unknown_error'}


def categorize_run(run) -> str:
    if run.status == 'running':
        return 'running'
    if run.status == 'playwright_fallback':
        return 'fallback'
    if run.status == 'error':
        return categorize_error(run.error_message)
    if getattr(run, 'error_count', 0):
        return 'partial_item_errors'
    return 'ok'


def categorize_item(item) -> str:
    if item.item_status == 'created':
        return 'ok'
    if item.item_status == 'duplicate':
        return 'duplicate_url'
    if item.item_status == 'filtered':
        return categorize_error(item.error_message) if item.error_message else 'selector_mismatch'
    if item.item_status == 'error':
        return categorize_error(item.error_message)
    return 'unknown_error'
