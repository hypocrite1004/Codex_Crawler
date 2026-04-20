import { API_URL, fetchWithAuth, getHeaders, logout } from './core';
import type { DashboardData } from './types';

export async function fetchDashboard(period: 'week' | 'month' = 'week'): Promise<DashboardData> {
    const res = await fetchWithAuth(`${API_URL}/dashboard/?period=${period}`, { headers: getHeaders() });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error('Dashboard fetch failed');
    return res.json();
}
