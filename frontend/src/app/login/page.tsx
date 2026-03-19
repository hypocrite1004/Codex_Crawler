"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, getErrorMessage } from '@/lib/api';

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState(() => {
        if (typeof window === 'undefined') {
            return '';
        }

        return new URLSearchParams(window.location.search).get('expired') === '1'
            ? '세션이 만료되었습니다. 다시 로그인해주세요.'
            : '';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('expired') === '1') {
                window.history.replaceState({}, '', '/login');
            }
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = await login(formData);
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);
            window.dispatchEvent(new Event('auth-change'));
            router.push('/');
            router.refresh();
        } catch (error: unknown) {
            setError(getErrorMessage(error, '로그인에 실패했습니다.'));
        }
    };

    return (
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Sign In</h2>
                {error && <div style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Username</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Password</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>Login</button>
                </form>
                <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
                    Do not have an account? <a href="/register" style={{ color: 'var(--accent-primary)' }}>Sign up</a>
                </div>
            </div>
        </div>
    );
}
