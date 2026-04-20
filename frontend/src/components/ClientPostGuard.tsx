"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchProfile, hasClientSession } from '@/lib/api';

export default function ClientPostGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            if (!hasClientSession()) {
                router.push('/login');
                return;
            }
            try {
                // 백엔드에 토큰 유효성 검증 (만료 시 401 에러로 catch로 떨어짐)
                await fetchProfile();
                setIsAuthorized(true);
            } catch {
                router.push('/login');
            }
        };
        checkAuth();
    }, [router]);

    if (!isAuthorized) {
        return (
            <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Checking authorization...
            </div>
        );
    }

    return <>{children}</>;
}
