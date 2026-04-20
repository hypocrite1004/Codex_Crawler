import type { AuthTokens } from './types';

const DEFAULT_API_URL = 'http://127.0.0.1:8000/api';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

function normalizeApiUrl(value: string): string {
    return value.replace(/\/+$/, '');
}

export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL);

export function getErrorMessage(error: unknown, fallback = 'Unexpected error'): string {
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

export function getHeaders(authRequired = true) {
    const token = getStoredAccessToken();
    return {
        'Content-Type': 'application/json',
        ...(token && authRequired ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
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
                    body: JSON.stringify({ refresh: refreshToken }),
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
                        Authorization: `Bearer ${data.access}`,
                    };
                    res = await fetch(url, newOptions);
                } else {
                    logout();
                    throw new Error('Session expired. Please log in again.');
                }
            } catch {
                logout();
                throw new Error('Session expired. Please log in again.');
            }
        } else {
            logout();
            throw new Error('Session expired. Please log in again.');
        }
    }
    return res;
}
