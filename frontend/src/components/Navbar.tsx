"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { fetchProfile, logout } from '@/lib/api';

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
                setIsVisible(false);
            } else {
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
            setIsAuthenticated(Boolean(token));
            if (token) {
                fetchProfile()
                    .then((user) => setIsStaff(Boolean(user.is_staff)))
                    .catch(() => setIsStaff(false));
            } else {
                setIsStaff(false);
            }
        };

        checkAuth();
        window.addEventListener('auth-change', checkAuth);
        return () => window.removeEventListener('auth-change', checkAuth);
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
                <Link href="/" className="logo text-gradient" style={{ fontSize: '1.25rem', letterSpacing: '0.05em' }}>
                    SECURNET
                </Link>
                <div className="nav-links">
                    <Link href="/cves" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        CVE Intel
                    </Link>
                    {isAuthenticated ? (
                        <>
                            {isStaff && (
                                <Link href="/dashboard" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Dashboard
                                </Link>
                            )}
                            <Link href="/create-post" style={{ color: 'var(--accent-secondary)' }}>
                                Write Insight
                            </Link>
                            {isStaff && (
                                <Link href="/admin/posts" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Admin
                                </Link>
                            )}
                            <Link
                                href="/profile"
                                className="btn btn-outline"
                                style={{ marginLeft: '1rem', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                            >
                                My Profile
                            </Link>
                            <button onClick={handleLogout} className="btn btn-outline" style={{ marginLeft: '1rem' }}>
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="btn btn-outline" style={{ marginLeft: '1rem' }}>
                                Sign In
                            </Link>
                            <Link href="/register" className="btn btn-primary">
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
