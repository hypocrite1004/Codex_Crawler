const DEFAULT_API_URL = 'http://127.0.0.1:8000/api';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

function normalizeApiUrl(value: string): string {
    return value.replace(/\/+$/, '');
}

export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL);

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

export function getErrorMessage(error: unknown, fallback = "Unexpected error"): string {
    return error instanceof Error ? error.message : fallback;
}

export function getStoredAccessToken(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

export function getStoredRefreshToken(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
}

export function hasClientSession(): boolean {
    return Boolean(getStoredAccessToken() || getStoredRefreshToken());
}

export function storeAuthTokens(tokens: AuthTokens) {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    window.dispatchEvent(new Event('auth-change'));
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const accessToken = getStoredAccessToken();
    let res = await fetch(url, options);
    if (res.status === 401 && typeof window !== 'undefined') {
        const refreshToken = getStoredRefreshToken();
        if (!accessToken && !refreshToken) {
            return res;
        }
        if (refreshToken) {
            try {
                const refreshRes = await fetch(`${API_URL}/token/refresh/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh: refreshToken })
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    storeAuthTokens({
                        access: data.access,
                        refresh: data.refresh || refreshToken,
                    });

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
    const token = getStoredAccessToken();
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
    related_count: number;
    cve_count: number;
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

function emptyPublicPostsResponse(page = 1, pageSize = 24): PublicPostsResponse {
    return {
        count: 0,
        next: null,
        previous: null,
        page,
        page_size: pageSize,
        site_options: [],
        results: [],
    };
}

async function fetchPostsListResponse(
    filters?: Record<string, string>,
    options?: {
        authRequired?: boolean;
        page?: number;
        pageSize?: number;
        defaultPageSize?: number;
    },
): Promise<PublicPostsResponse> {
    const authRequired = options?.authRequired ?? false;
    const page = options?.page ?? 1;
    const defaultPageSize = options?.defaultPageSize ?? 24;

    try {
        const params = new URLSearchParams(filters || {});
        if (options?.pageSize !== undefined) {
            params.set('page', String(page));
            params.set('page_size', String(options.pageSize));
        }

        const query = params.toString();
        const url = query ? `${API_URL}/posts/?${query}` : `${API_URL}/posts/`;
        const res = await fetchWithAuth(url, {
            headers: getHeaders(authRequired),
            cache: 'no-store'
        });
        if (res.status === 401) {
            logout();
            throw new Error("Session expired. Please log in again.");
        }
        if (!res.ok) {
            console.error('Failed to fetch posts response:', await res.text());
            return emptyPublicPostsResponse(page, options?.pageSize ?? defaultPageSize);
        }
        return res.json();
    } catch (error) {
        console.error('Error fetching posts response:', error);
        return emptyPublicPostsResponse(page, options?.pageSize ?? defaultPageSize);
    }
}

export async function fetchPosts(filters?: Record<string, string>): Promise<PostListItem[]> {
    const response = await fetchPostsListResponse(filters, { authRequired: false });
    return response.results;
}

export async function fetchPostFeed(
    filters?: Record<string, string>,
    page = 1,
    pageSize = 24,
): Promise<PublicPostsResponse> {
    return fetchPostsListResponse(filters, {
        authRequired: false,
        page,
        pageSize,
        defaultPageSize: pageSize,
    });
}

export async function fetchMyPosts(filters?: Record<string, string>): Promise<Post[]> {
    const response = await fetchPostsListResponse(
        { ...(filters || {}), mine: 'true', limit: '200' },
        { authRequired: true, defaultPageSize: 200 },
    );
    return response.results as unknown as Post[];
}

export async function fetchPost(id: string, includeAuth = false): Promise<Post | null> {
    try {
        const res = await fetchWithAuth(`${API_URL}/posts/${id}/`, {
            headers: getHeaders(includeAuth),
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

export async function fetchAdminPosts(
    category?: string | null,
    search?: string,
    site?: string,
    is_summarized?: string,
    is_shared?: string,
    status?: PostStatus | '',
    page = 1,
    pageSize = 50,
): Promise<AdminPostsResponse> {
    try {
        const params = new URLSearchParams();
        params.append('is_admin_list', 'true');
        params.append('page', String(page));
        params.append('page_size', String(pageSize));
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        if (site) params.append('site', site);
        if (is_summarized) params.append('is_summarized', is_summarized);
        if (is_shared) params.append('is_shared', is_shared);
        if (status) params.append('status', status);

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
            return {
                count: 0,
                next: null,
                previous: null,
                page,
                page_size: pageSize,
                site_options: [],
                results: [],
            };
        }
        return res.json();
    } catch (error) {
        console.error('Error fetching admin posts:', error);
        return {
            count: 0,
            next: null,
            previous: null,
            page,
            page_size: pageSize,
            site_options: [],
            results: [],
        };
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
        method: 'POST',
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

export async function fetchCves(filters?: Record<string, string>): Promise<CveRecord[]> {
    try {
        let url = `${API_URL}/cves/`;
        if (filters && Object.keys(filters).length > 0) {
            const searchParams = new URLSearchParams(filters);
            url += `?${searchParams.toString()}`;
        }
        const res = await fetchWithAuth(url, {
            headers: getHeaders(false),
            cache: 'no-store',
        });
        if (!res.ok) {
            console.error('Failed to fetch cves:', await res.text());
            return [];
        }
        return res.json();
    } catch (error) {
        console.error('Error fetching cves:', error);
        return [];
    }
}

export async function fetchCve(id: string): Promise<CveRecord | null> {
    try {
        const res = await fetchWithAuth(`${API_URL}/cves/${id}/`, {
            headers: getHeaders(false),
            cache: 'no-store',
        });
        if (!res.ok) {
            console.error(`Failed to fetch cve ${id}:`, await res.text());
            return null;
        }
        return res.json();
    } catch (error) {
        console.error(`Error fetching cve ${id}:`, error);
        return null;
    }
}

export async function fetchCvePosts(id: string): Promise<Post[]> {
    try {
        const res = await fetchWithAuth(`${API_URL}/cves/${id}/posts/`, {
            headers: getHeaders(false),
            cache: 'no-store',
        });
        if (!res.ok) {
            console.error(`Failed to fetch cve posts ${id}:`, await res.text());
            return [];
        }
        return res.json();
    } catch (error) {
        console.error(`Error fetching cve posts ${id}:`, error);
        return [];
    }
}

async function postWorkflowAction(postId: number, action: string, body?: Record<string, unknown>): Promise<PostWorkflowResult> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/${action}/`, {
        method: 'POST',
        headers: getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
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

export async function submitPostForReview(postId: number): Promise<PostWorkflowResult> {
    return postWorkflowAction(postId, 'submit_for_review');
}

export async function approvePost(postId: number): Promise<PostWorkflowResult> {
    return postWorkflowAction(postId, 'approve');
}

export async function rejectPost(postId: number, reason: string): Promise<PostWorkflowResult> {
    return postWorkflowAction(postId, 'reject', { reason });
}

export async function archivePost(postId: number): Promise<PostWorkflowResult> {
    return postWorkflowAction(postId, 'archive');
}

export async function restorePostToDraft(postId: number): Promise<PostWorkflowResult> {
    return postWorkflowAction(postId, 'restore_to_draft');
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
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.dispatchEvent(new Event('auth-change'));
        if (window.location.pathname !== '/login') {
            window.location.href = '/login?expired=1';
        }
    }
}

export async function fetchProfile(): Promise<AuthUser> {
    const hasSession = hasClientSession();

    const res = await fetchWithAuth(`${API_URL}/users/me/`, {
        headers: getHeaders(),
        cache: 'no-store'
    });
    if (res.status === 401) {
        if (hasSession) {
            logout();
        }
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

export async function fetchDashboard(period: 'week' | 'month' = 'week'): Promise<DashboardData> {
    const res = await fetchWithAuth(`${API_URL}/dashboard/?period=${period}`, { headers: getHeaders() });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) throw new Error('Dashboard fetch failed');
    return res.json();
}
