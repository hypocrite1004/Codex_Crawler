import AdminGuard from '@/components/AdminGuard';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminGuard>
            <div style={{ display: 'flex', minHeight: 'calc(100vh - 70px)' }}>
                {/* Admin Sidebar */}
                <aside style={{ width: '250px', background: 'rgba(0,0,0,0.3)', borderRight: '1px solid var(--glass-border)', padding: '2rem 1rem' }}>
                    <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '2rem', paddingLeft: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        ⚙️ 관리자 제어반
                    </h2>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <Link href="/admin/crawler" style={{ padding: '0.8rem 1rem', borderRadius: '8px', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'background 0.2s', display: 'block' }}>
                            🕷️ 크롤러 소스 관리
                        </Link>
                        <Link href="/admin/ai" style={{ padding: '0.8rem 1rem', borderRadius: '8px', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'background 0.2s', display: 'block' }}>
                            🤖 AI 모델 & 유사도 설정
                        </Link>
                        <Link href="/admin/posts" style={{ padding: '0.8rem 1rem', borderRadius: '8px', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'background 0.2s', display: 'block' }}>
                            📝 전체 게시물 관리
                        </Link>
                    </nav>
                </aside>

                {/* Admin Content Area */}
                <main style={{ flex: 1, padding: '2rem', background: 'var(--bg-primary)', overflowY: 'auto' }}>
                    {children}
                </main>
            </div>

            {/* Override global sidebar background active states via CSS for admin pages if needed */}
            <style dangerouslySetInnerHTML={{
                __html: `
                nav a:hover {
                    background: rgba(255,255,255,0.05);
                    color: var(--text-primary);
                }
            `}} />
        </AdminGuard>
    );
}
