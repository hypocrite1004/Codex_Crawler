"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchProfile, getErrorMessage, type AuthUser, updateProfile } from '@/lib/api';

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<AuthUser>({ id: 0, username: '', email: '', is_staff: false });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (!localStorage.getItem('access_token')) {
            router.push('/login');
            return;
        }

        fetchProfile()
            .then((data) => {
                setProfile(data);
                setLoading(false);
            })
            .catch((error: unknown) => {
                console.error("Error fetching profile", error);
                setError(getErrorMessage(error, '프로필을 불러오지 못했습니다.'));
                setLoading(false);
            });
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            await updateProfile({ username: profile.username, email: profile.email });
            setSuccess('프로필을 업데이트했습니다.');
            router.refresh();
        } catch (error: unknown) {
            setError(getErrorMessage(error, '프로필 업데이트에 실패했습니다.'));
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Decrypting profile data...</div>;
    }

    return (
        <div className="container" style={{ maxWidth: '600px', margin: '40px auto' }}>
            <div className="glass-panel">
                <h2 style={{ marginBottom: '2rem' }}>My Profile</h2>
                {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
                {success && <div style={{ color: 'var(--accent-secondary)', marginBottom: '1rem' }}>{success}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Agent ID</label>
                        <input
                            type="text"
                            value={profile.id || ''}
                            disabled
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'not-allowed' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Username</label>
                        <input
                            type="text"
                            value={profile.username}
                            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email</label>
                        <input
                            type="email"
                            value={profile.email}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', width: '100%' }}>Update Information</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
