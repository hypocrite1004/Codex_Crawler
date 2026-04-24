import { API_URL, fetchWithAuth, getHeaders, logout } from './core';
import type { CrawlItem, CrawlerLog, CrawlerMetrics, CrawlerPreviewItem, CrawlerRun, CrawlerSource } from './types';

export async function fetchCrawlerSources(): Promise<CrawlerSource[]> {
    try {
        const res = await fetchWithAuth(`${API_URL}/crawler-sources/`, { headers: getHeaders(false) });
        if (res.status === 401) {
            logout();
            throw new Error('Session expired. Please log in again.');
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
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create crawler source');
    return res.json();
}

export async function updateCrawlerSource(id: number, data: Partial<CrawlerSource>): Promise<CrawlerSource> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/${id}/`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update crawler source');
    return res.json();
}

export async function deleteCrawlerSource(id: number): Promise<void> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/${id}/`, {
        method: 'DELETE',
        headers: getHeaders(),
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
    run_id: number | null;
}> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/${id}/crawl/`, {
        method: 'POST',
        headers: getHeaders(),
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

export async function fetchCrawlerRuns(sourceId?: number): Promise<CrawlerRun[]> {
    const query = sourceId ? `?source=${sourceId}` : '';
    const res = await fetchWithAuth(`${API_URL}/crawler-runs/${query}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch crawler runs');
    return res.json();
}

export async function fetchCrawlerRunItems(runId: number): Promise<CrawlItem[]> {
    const res = await fetchWithAuth(`${API_URL}/crawler-runs/${runId}/items/`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch crawler run items');
    return res.json();
}

export async function fetchCrawlerMetrics(): Promise<CrawlerMetrics> {
    const res = await fetchWithAuth(`${API_URL}/crawler-runs/metrics/`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch crawler metrics');
    return res.json();
}

export async function previewCrawl(data: Partial<CrawlerSource>): Promise<{ items: CrawlerPreviewItem[]; status: string; error: string }> {
    const res = await fetchWithAuth(`${API_URL}/crawler-sources/preview/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Preview failed');
    return json;
}
