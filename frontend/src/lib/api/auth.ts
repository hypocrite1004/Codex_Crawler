import { API_URL, fetchWithAuth, getHeaders, hasClientSession, logout } from './core';
import type { AuthTokens, AuthUser, LoginCredentials, ProfileUpdatePayload, RegisterPayload } from './types';

export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
    const res = await fetch(`${API_URL}/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
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
        body: JSON.stringify(userData),
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}

export async function fetchProfile(): Promise<AuthUser> {
    const hasSession = hasClientSession();

    const res = await fetchWithAuth(`${API_URL}/users/me/`, {
        headers: getHeaders(),
        cache: 'no-store',
    });
    if (res.status === 401) {
        if (hasSession) {
            logout();
        }
        throw new Error('Session expired. Please log in again.');
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
