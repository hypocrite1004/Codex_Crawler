import { API_URL, fetchWithAuth, getHeaders } from './core';
import type { CveRecord, Post } from './types';

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
