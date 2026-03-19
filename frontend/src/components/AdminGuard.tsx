"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchProfile } from '@/lib/api';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await fetchProfile();
                if (user && user.is_staff) {
                    setIsAuthorized(true);
                } else {
                    router.replace('/');
                }
            } catch {
                router.replace('/login');
            }
        };
        checkAuth();
    }, [router]);

    if (isAuthorized === null) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
                관리자 권한 확인 중...
            </div>
        );
    }

    return <>{children}</>;
}
