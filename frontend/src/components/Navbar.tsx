"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { logout, fetchProfile } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function Navbar() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isStaff, setIsStaff] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const router = useRouter();

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY > lastScrollY && currentScrollY > 60) {
                // Scrolling down past threshold
                setIsVisible(false);
            } else {
                // Scrolling up
                setIsVisible(true);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('access_token');
            setIsAuthenticated(!!token);
            if (token) {
                fetchProfile().then(u => setIsStaff(!!u.is_staff)).catch(() => setIsStaff(false));
            } else {
                setIsStaff(false);
            }
        };
        // Initial check
        checkAuth();

        // Listen for custom login/logout events
        window.addEventListener('auth-change', checkAuth);

        return () => {
            window.removeEventListener('auth-change', checkAuth);
        };
    }, []);

    const handleLogout = () => {
        logout();
        setIsAuthenticated(false);
        router.push('/');
        router.refresh();
    };

    return (
        <nav className={`navbar ${isVisible ? 'visible' : 'hidden'}`}>
            <div className="container nav-container">
                <Link href="/" className="logo text-gradient" style={{ fontSize: '1.25rem', letterSpacing: '0.05em' }}>SECURNET</Link>
                <div className="nav-links">
                    {isAuthenticated ? (
                        <>
                            <Link href="/dashboard" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>📊 Dashboard</Link>
                            <Link href="/create-post" style={{ color: "var(--accent-secondary)" }}>Write Insight</Link>
                            {isStaff && (
                                <Link href="/admin/crawler" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>⚙️ 관리자 설정</Link>
                            )}
                            <Link href="/profile" className="btn btn-outline" style={{ marginLeft: "1rem", borderColor: "var(--accent-primary)", color: "var(--accent-primary)" }}>My Profile</Link>
                            <button onClick={handleLogout} className="btn btn-outline" style={{ marginLeft: "1rem" }}>Logout</button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="btn btn-outline" style={{ marginLeft: "1rem" }}>Sign In</Link>
                            <Link href="/register" className="btn btn-primary">Sign Up</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
