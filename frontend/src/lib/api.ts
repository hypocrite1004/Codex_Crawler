export const API_URL = "http://127.0.0.1:8000/api";

export interface AuthTokens {
    access: string;
    refresh: string;
}

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    is_staff: boolean;
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

export function getErrorMessage(error: unknown, fallback = "Unexpected error"): string {
    return error instanceof Error ? error.message : fallback;
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let res = await fetch(url, options);
    if (res.status === 401 && typeof window !== 'undefined') {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
            try {
                const refreshRes = await fetch(`${API_URL}/token/refresh/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh: refreshToken })
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    localStorage.setItem('access_token', data.access);
                    if (data.refresh) {
                        localStorage.setItem('refresh_token', data.refresh);
                    }

                    const newOptions = { ...options };
                    newOptions.headers = {
                        ...newOptions.headers,
                        'Authorization': `Bearer ${data.access}`
                    };
                    res = await fetch(url, newOptions);
                } else {
                    logout();
                    throw new Error("Session expired. Please log in again.");
                }
            } catch {
                logout();
                throw new Error("Session expired. Please log in again.");
            }
        } else {
            logout();
            throw new Error("Session expired. Please log in again.");
        }
    }
    return res;
}

export function getHeaders(authRequired = true) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    return {
        'Content-Type': 'application/json',
        ...(token && authRequired ? { 'Authorization': `Bearer ${token}` } : {})
    };
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
}

export async function fetchPosts(filters?: Record<string, string>): Promise<Post[]> {
    try {
        let url = `${API_URL}/posts/`;
        if (filters && Object.keys(filters).length > 0) {
            const searchParams = new URLSearchParams(filters);
            url += `?${searchParams.toString()}`;
        }

        const res = await fetchWithAuth(url, {
            headers: getHeaders(false),
            cache: 'no-store'
        });
        if (res.status === 401) {
            logout();
            throw new Error("Session expired. Please log in again.");
        }
        if (!res.ok) {
            console.error('Failed to fetch posts:', await res.text());
            return [];
        }
        return res.json();
    } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
}

export async function fetchPost(id: string): Promise<Post | null> {
    try {
        const res = await fetchWithAuth(`${API_URL}/posts/${id}/`, {
            headers: getHeaders(false),
            cache: 'no-store'
        });
        if (!res.ok) {
            console.error(`Failed to fetch post ${id}:`, await res.text());
            return null;
        }
        return res.json();
    } catch (error) {
        console.error(`Error fetching post ${id}:`, error);
        return null;
    }
}

export async function createPost(postData: CreatePostPayload): Promise<Post> {
    const res = await fetchWithAuth(`${API_URL}/posts/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(postData)
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export async function fetchAdminPosts(category?: string | null, search?: string, site?: string, is_summarized?: string, is_shared?: string): Promise<Post[]> {
    try {
        const params = new URLSearchParams();
        params.append('is_admin_list', 'true');
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        if (site) params.append('site', site);
        if (is_summarized) params.append('is_summarized', is_summarized);
        if (is_shared) params.append('is_shared', is_shared);

        const res = await fetchWithAuth(`${API_URL}/posts/?${params.toString()}`, {
            headers: getHeaders(),
            cache: 'no-store'
        });
        if (res.status === 401) {
            logout();
            throw new Error("Session expired. Please log in again.");
        }
        if (!res.ok) {
            console.error('Failed to fetch admin posts:', await res.text());
            return [];
        }
        return res.json();
    } catch (error) {
        console.error('Error fetching admin posts:', error);
        return [];
    }
}

export async function updatePost(id: number, data: Partial<Post>): Promise<Post> {
    const res = await fetchWithAuth(`${API_URL}/posts/${id}/`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data)
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export async function deletePost(id: number): Promise<void> {
    const res = await fetchWithAuth(`${API_URL}/posts/${id}/`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
}

export async function addComment(postId: number, content: string): Promise<Comment> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/add_comment/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content })
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export async function updateComment(commentId: number, content: string): Promise<Comment> {
    const res = await fetchWithAuth(`${API_URL}/comments/${commentId}/`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ content })
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export async function deleteComment(commentId: number): Promise<void> {
    const res = await fetchWithAuth(`${API_URL}/comments/${commentId}/`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
}

export async function summarizePost(postId: number): Promise<string> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/summarize/`, {
        headers: getHeaders(false),
        cache: 'no-store'
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    const data = await res.json();
    return data.summary;
}

export async function updateSummary(postId: number, summary: string): Promise<string> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/summarize/`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ summary })
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    const data = await res.json();
    return data.summary;
}

export async function deleteSummary(postId: number): Promise<void> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/summarize/`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
}

export async function toggleSharePost(postId: number): Promise<boolean> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/toggle_share/`, {
        method: 'POST',
        headers: getHeaders()
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    const data = await res.json();
    return data.is_shared;
}

export async function fetchCategories(): Promise<Category[]> {
    try {
        const res = await fetchWithAuth(`${API_URL}/categories/`, {
            headers: getHeaders(false),
            cache: 'no-store'
        });
        if (!res.ok) {
            console.error('Failed to fetch categories:', await res.text());
            return [];
        }
        return res.json();
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
    const res = await fetch(`${API_URL}/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export async function register(userData: RegisterPayload): Promise<AuthUser> {
    const res = await fetch(`${API_URL}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export function logout() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth-change'));
        if (window.location.pathname !== '/login') {
            window.location.href = '/login?expired=1';
        }
    }
}

export async function fetchProfile(): Promise<AuthUser> {
    const res = await fetchWithAuth(`${API_URL}/users/me/`, {
        headers: getHeaders(),
        cache: 'no-store'
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export async function updateProfile(data: ProfileUpdatePayload): Promise<AuthUser> {
    const res = await fetchWithAuth(`${API_URL}/users/me/`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

// ─── AI Config ───────────────────────────────────────────────────────────────

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

export async function fetchAIConfig(): Promise<AIConfig> {
    const res = await fetchWithAuth(`${API_URL}/ai-config/`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch AI config');
    return res.json();
}

export async function updateAIConfig(data: Partial<Omit<AIConfig, 'id' | 'updated_at'>>): Promise<AIConfig> {
    const res = await fetchWithAuth(`${API_URL}/ai-config/`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export interface ClusteringTestResult {
    clusters: { parent: string; children: string[] }[];
    unclustered_count: number;
    total_tested: number;
}

export async function testClustering(threshold: number): Promise<ClusteringTestResult> {
    const res = await fetchWithAuth(`${API_URL}/ai-config/test_clustering/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ threshold })
    });
    if (!res.ok) throw new Error('Failed to run clustering test');
    return res.json();
}

export interface AIModelItem {
    id: string;
    category: string;
}

export async function fetchAIModels(): Promise<{ models: AIModelItem[]; source: 'openai' | 'fallback' }> {
    const res = await fetchWithAuth(`${API_URL}/ai-models/`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch model list');
    return res.json();
}

// ─── Crawler Source API ───────────────────────────────────────────────────────

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

export async function fetchCrawlerSources(): Promise<CrawlerSource[]> {
    try {
        const res = await fetchWithAuth(`${API_URL}/crawler-sources/`, { headers: getHeaders(false) });
        if (res.status === 401) {
            logout();
            throw new Error("Session expired. Please log in again.");
        }
        if (!res.ok) {
            console.error('Failed to fetch crawler sources:', await res.text());
            return [];
        }
        return res.json();
    } catch (err) {
        console.error('Error fetching crawler sources', err);
        return [];
    }
}

export async function createCrawlerSource(data: Partial<CrawlerSource>): Promise<CrawlerSource> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create crawler source');
    return res.json();
}

export async function updateCrawlerSource(id: number, data: Partial<CrawlerSource>): Promise<CrawlerSource> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/${id}/`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update crawler source');
    return res.json();
}

export async function deleteCrawlerSource(id: number): Promise<void> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/${id}/`, {
        method: 'DELETE', headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete crawler source');
}

export async function runCrawl(id: number): Promise<{
    created: number;
    found: number;
    status: 'success' | 'playwright_fallback' | 'error' | 'running';
    error: string;
    attempt_count: number;
    duration_seconds: number;
}> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/${id}/crawl/`, {
        method: 'POST', headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Crawl failed');
    return data;
}

export async function fetchCrawlerLogs(id: number): Promise<CrawlerLog[]> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/${id}/logs/`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
}

export interface CrawlerPreviewItem {
    title: string;
    url: string;
    content_preview: string;
    content?: string;
    content_html?: string;
}

export async function previewCrawl(data: Partial<CrawlerSource>): Promise<{ items: CrawlerPreviewItem[]; status: string; error: string }> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/preview/`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Preview failed');
    return json;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardSummary {
    total_posts: number;
    period_posts: number;
    prev_period_posts: number;
    active_sources: number;
    total_sources: number;
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
    site: string;
    source_url: string;
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

export interface DashboardData {
    summary: DashboardSummary;
    daily_trend: DailyTrend[];
    category_dist: CategoryDist[];
    trending_keywords: TrendingKeyword[];
    recent_posts: RecentPost[];
    bubble_data: BubbleData[];
}

export async function fetchDashboard(period: 'week' | 'month' = 'week'): Promise<DashboardData> {
    const res = await fetchWithAuth(`${API_URL}/dashboard/?period=${period}`, { headers: getHeaders() });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) throw new Error('Dashboard fetch failed');
    return res.json();
}
