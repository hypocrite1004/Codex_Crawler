export interface AuthTokens {
    access: string;
    refresh: string;
}

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    is_staff: boolean;
    is_superuser: boolean;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface RegisterPayload extends LoginCredentials {
    email: string;
}

export interface ProfileUpdatePayload {
    username: string;
    email: string;
}

export interface CreatePostPayload {
    title: string;
    content: string;
    category: number | string;
    site: string;
    source_url: string;
    is_draft: boolean;
}

export type PostStatus = 'draft' | 'review' | 'rejected' | 'published' | 'archived';

export interface PostWorkflowResult {
    status: PostStatus;
    rejection_reason?: string;
}

export interface Category {
    id: number;
    name: string;
    description: string;
}

export interface Comment {
    id: number;
    content: string;
    author: {
        id: number;
        username: string;
    };
    created_at: string;
}

export interface CveMention {
    id: number;
    cve: number;
    cve_id: string;
    severity: string;
    cvss_score: number | null;
    mention_count: number;
    legacy_mention_count: number;
    vendor: string;
    product: string;
    mentioned_in: 'title' | 'content' | 'both';
    legacy_reference_ids: number[];
    created_at: string;
}

export interface CveRecord {
    id: number;
    cve_id: string;
    description: string;
    severity: string;
    cvss_score: number | null;
    published_date: string | null;
    vendor: string;
    product: string;
    is_tracked: boolean;
    notes: string;
    mention_count: number;
    legacy_mention_count: number;
    post_count: number;
    first_seen: string | null;
    last_seen: string | null;
    created_at: string;
    updated_at: string;
}

export interface Post {
    id: number;
    title: string;
    content: string;
    site: string | null;
    source_url: string | null;
    category: number | null;
    category_name: string;
    author: {
        id: number;
        username: string;
    };
    comments: Comment[];
    is_shared: boolean;
    is_summarized: boolean;
    summary: string | null;
    is_draft: boolean;
    status: PostStatus;
    approval_requested_at: string | null;
    approved_by: number | null;
    approved_by_name?: string;
    approved_at: string | null;
    rejected_by: number | null;
    rejected_by_name?: string;
    rejected_at: string | null;
    rejection_reason: string;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    views: number;
    related_count: number;
    related_posts_list?: {
        id: number;
        title: string;
        site: string;
        source_url: string;
        created_at: string;
    }[];
    published_at?: string | null;
    iocs?: string[];
    cve_mentions?: CveMention[];
}

export interface PostListItem {
    id: number;
    title: string;
    site: string | null;
    source_url: string | null;
    category: number | null;
    category_name: string;
    author: {
        id: number;
        username: string;
    };
    is_shared: boolean;
    is_summarized: boolean;
    status: PostStatus;
    created_at: string;
    published_at?: string | null;
    related_count: number;
    cve_count: number;
    ioc_count: number;
    content_preview: string;
}

export interface AdminPostListItem {
    id: number;
    title: string;
    site: string | null;
    source_url: string | null;
    category: number | null;
    category_name: string;
    status: PostStatus;
    is_summarized: boolean;
    created_at: string;
    related_count: number;
    approval_requested_at: string | null;
    approved_by_name?: string;
    approved_at: string | null;
    rejected_by_name?: string;
    rejected_at: string | null;
    rejection_reason: string;
    archived_at: string | null;
}

export interface AdminPostsResponse {
    count: number;
    next: string | null;
    previous: string | null;
    page: number;
    page_size: number;
    site_options: string[];
    results: AdminPostListItem[];
}

export interface PublicPostsResponse {
    count: number;
    next: string | null;
    previous: string | null;
    page: number;
    page_size: number;
    site_options: string[];
    results: PostListItem[];
}

export interface AIConfig {
    id: number;
    model: string;
    system_prompt: string;
    max_tokens: number;
    temperature: number;
    similarity_threshold: number;
    telegram_bot_token: string;
    telegram_chat_id: string;
    updated_at: string;
}

export interface ClusteringTestResult {
    clusters: { parent: string; children: string[] }[];
    unclustered_count: number;
    total_tested: number;
}

export interface AIModelItem {
    id: string;
    category: string;
}

export interface CrawlerSource {
    id: number;
    name: string;
    url: string;
    source_type: 'rss' | 'html';
    is_active: boolean;
    category: number | null;
    category_name: string | null;
    crawl_interval: number;
    last_crawled_at: string | null;
    last_success_at: string | null;
    last_run_started_at: string | null;
    is_running: boolean;
    last_status: 'idle' | 'success' | 'playwright_fallback' | 'error';
    last_error_message: string;
    consecutive_failures: number;
    max_retries: number;
    retry_backoff_minutes: number;
    auto_disable_after_failures: number;
    next_crawl_at: string | null;
    health_status: 'healthy' | 'warning' | 'error' | 'running' | 'paused' | 'disabled' | 'pending' | 'idle';
    http_method: 'GET' | 'POST';
    request_headers: Record<string, string>;
    request_body: Record<string, unknown>;
    article_list_selector: string;
    article_link_selector: string;
    title_selector: string;
    content_selector: string;
    date_selector: string;
    fetch_full_content: boolean;
    full_content_selector: string;
    exclude_selectors: string;
    created_at: string;
    logs: CrawlerLog[];
}

export interface CrawlerLog {
    id: number;
    status: 'success' | 'playwright_fallback' | 'error';
    articles_found: number;
    articles_created: number;
    error_message: string;
    triggered_by: 'manual' | 'scheduled';
    attempt_count: number;
    duration_seconds: number;
    crawled_at: string;
}

export interface CrawlerRun {
    id: number;
    source: number;
    source_name: string;
    triggered_by: 'manual' | 'scheduled';
    status: 'running' | 'success' | 'playwright_fallback' | 'error';
    started_at: string;
    finished_at: string | null;
    attempt_count: number;
    articles_found: number;
    articles_created: number;
    duplicate_count: number;
    filtered_count: number;
    error_count: number;
    duration_seconds: number;
    error_message: string;
    item_count: number;
    diagnostic_category: string;
    diagnostic_label: string;
    diagnostic_hint: string;
}

export interface CrawlItem {
    id: number;
    item_status: 'created' | 'duplicate' | 'filtered' | 'error';
    source_url: string;
    normalized_url: string;
    title: string;
    error_message: string;
    payload: Record<string, unknown>;
    post_id: number | null;
    created_at: string;
    diagnostic_category: string;
    diagnostic_label: string;
    diagnostic_hint: string;
}

export interface CrawlerMetricPeriod {
    since: string;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    running_runs: number;
    success_rate: number;
    articles_found: number;
    articles_created: number;
    duplicate_count: number;
    filtered_count: number;
    error_count: number;
    duration_seconds: number;
}

export interface CrawlerSourceMetric {
    source_id: number;
    source_name: string;
    health_status: CrawlerSource['health_status'];
    recent_runs: number;
    successful_runs: number;
    failed_runs: number;
    success_rate: number;
    articles_created: number;
    item_errors: number;
    last_run_at: string | null;
}

export interface CrawlerReliabilityAlert {
    source_id: number;
    source_name: string;
    severity: 'warning' | 'error';
    category: 'stale_running' | 'high_failure_rate' | 'no_recent_success' | 'high_item_error_rate';
    title: string;
    message: string;
}

export interface CrawlerMetrics {
    periods: {
        '24h': CrawlerMetricPeriod;
        '7d': CrawlerMetricPeriod;
    };
    sources: CrawlerSourceMetric[];
    alerts: CrawlerReliabilityAlert[];
}

export interface CrawlerPreviewItem {
    title: string;
    url: string;
    content_preview: string;
    content?: string;
    content_html?: string;
}

export interface DashboardSummary {
    total_posts: number;
    period_posts: number;
    prev_period_posts: number;
    active_sources?: number;
    total_sources?: number;
    last_crawled_at: string | null;
}

export interface DailyTrend {
    date: string;
    total: number;
    [category: string]: number | string;
}

export interface CategoryDist {
    name: string;
    current: number;
    prev: number;
}

export interface TrendingKeyword {
    word: string;
    count: number;
    prev_count: number;
    change_pct: number;
}

export interface RecentPost {
    id: number;
    title: string;
    site: string | null;
    created_at: string;
    category: string;
    related_count: number;
}

export interface BubbleData {
    id: number;
    title: string;
    x: number;
    y: number;
    z: number;
    related_count: number;
    category: string;
}

export interface TopCve {
    cve_id: string;
    severity: string;
    cvss_score: number | null;
    mention_count: number;
    last_seen: string | null;
    post_count: number;
}

export interface DashboardData {
    summary: DashboardSummary;
    daily_trend: DailyTrend[];
    category_dist: CategoryDist[];
    trending_keywords: TrendingKeyword[];
    recent_posts: RecentPost[];
    top_cves: TopCve[];
    bubble_data: BubbleData[];
}
