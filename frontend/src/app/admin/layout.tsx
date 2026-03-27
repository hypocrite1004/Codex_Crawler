'use client';

import AdminGuard from '@/components/AdminGuard';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchProfile } from '@/lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        fetchProfile()
            .then((user) => setIsAdmin(Boolean(user.is_superuser)))
            .catch(() => setIsAdmin(false));
    }, []);

    return (
        <AdminGuard>
            <div style={{ display: 'flex', minHeight: 'calc(100vh - 70px)' }}>
                <aside
                    style={{
                        width: '250px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRight: '1px solid var(--glass-border)',
                        padding: '2rem 1rem',
                    }}
                >
                    <h2
                        style={{
                            fontSize: '1.2rem',
                            color: 'var(--text-primary)',
                            marginBottom: '2rem',
                            paddingLeft: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        운영 관리자 사이드바
                    </h2>
                    <nav data-role={isAdmin ? 'admin' : 'staff'} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {isAdmin && (
                            <Link
                                href="/admin/crawler"
                                style={{
                                    padding: '0.8rem 1rem',
                                    borderRadius: '8px',
                                    color: 'var(--text-secondary)',
                                    textDecoration: 'none',
                                    transition: 'background 0.2s',
                                    display: 'block',
                                }}
                            >
                                크롤러 소스 관리
                            </Link>
                        )}
                        {isAdmin && (
                            <Link
                                href="/admin/ai"
                                style={{
                                    padding: '0.8rem 1rem',
                                    borderRadius: '8px',
                                    color: 'var(--text-secondary)',
                                    textDecoration: 'none',
                                    transition: 'background 0.2s',
                                    display: 'block',
                                }}
                            >
                                AI 모델 및 유사도 설정
                            </Link>
                        )}
                        <Link
                            href="/admin/posts"
                            style={{
                                padding: '0.8rem 1rem',
                                borderRadius: '8px',
                                color: 'var(--text-secondary)',
                                textDecoration: 'none',
                                transition: 'background 0.2s',
                                display: 'block',
                            }}
                        >
                            전체 게시물 관리
                        </Link>
                    </nav>
                </aside>

                <main style={{ flex: 1, padding: '2rem', background: 'var(--bg-primary)', overflowY: 'auto' }}>
                    {children}
                </main>
            </div>

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                nav a:hover {
                    background: rgba(255,255,255,0.05);
                    color: var(--text-primary);
                }
            `,
                }}
            />
        </AdminGuard>
    );
}
