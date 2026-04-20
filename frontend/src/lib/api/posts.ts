import { API_URL, fetchWithAuth, getHeaders, logout } from './core';
import type {
    AdminPostsResponse,
    Category,
    Comment,
    CreatePostPayload,
    Post,
    PostListItem,
    PostStatus,
    PostWorkflowResult,
    PublicPostsResponse,
} from './types';

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
            cache: 'no-store',
        });
        if (res.status === 401) {
            logout();
            throw new Error('Session expired. Please log in again.');
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
            cache: 'no-store',
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
        body: JSON.stringify(postData),
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
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
            cache: 'no-store',
        });
        if (res.status === 401) {
            logout();
            throw new Error('Session expired. Please log in again.');
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
        body: JSON.stringify(data),
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export async function deletePost(id: number): Promise<void> {
    const res = await fetchWithAuth(`${API_URL}/posts/${id}/`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
}

export async function addComment(postId: number, content: string): Promise<Comment> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/add_comment/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content }),
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
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
        body: JSON.stringify({ content }),
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export async function deleteComment(commentId: number): Promise<void> {
    const res = await fetchWithAuth(`${API_URL}/comments/${commentId}/`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
}

export async function summarizePost(postId: number): Promise<string> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/summarize/`, {
        method: 'POST',
        headers: getHeaders(),
        cache: 'no-store',
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
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
        body: JSON.stringify({ summary }),
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired.');
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
        headers: getHeaders(),
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired.');
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
}

export async function toggleSharePost(postId: number): Promise<boolean> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/toggle_share/`, {
        method: 'POST',
        headers: getHeaders(),
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) {
        throw new Error(await res.text());
    }
    const data = await res.json();
    return data.is_shared;
}

async function postWorkflowAction(postId: number, action: string, body?: Record<string, unknown>): Promise<PostWorkflowResult> {
    const res = await fetchWithAuth(`${API_URL}/posts/${postId}/${action}/`, {
        method: 'POST',
        headers: getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
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
            cache: 'no-store',
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
