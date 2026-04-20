import { API_URL, fetchWithAuth, getHeaders } from './core';
import type { AIConfig, AIModelItem, ClusteringTestResult } from './types';

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

export async function testClustering(threshold: number): Promise<ClusteringTestResult> {
    const res = await fetchWithAuth(`${API_URL}/ai-config/test_clustering/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ threshold }),
    });
    if (!res.ok) throw new Error('Failed to run clustering test');
    return res.json();
}

export async function fetchAIModels(): Promise<{ models: AIModelItem[]; source: 'openai' | 'fallback' }> {
    const res = await fetchWithAuth(`${API_URL}/ai-models/`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch model list');
    return res.json();
}
