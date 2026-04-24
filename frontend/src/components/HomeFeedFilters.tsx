import type { Category } from '@/lib/api';

export default function HomeFeedFilters({
  totalCount,
  postsCount,
  searchQuery,
  onSearchChange,
  showFilters,
  onToggleFilters,
  filterSite,
  onSiteChange,
  siteOptions,
  filterDateFrom,
  onDateFromChange,
  filterDateTo,
  onDateToChange,
  filterCve,
  onCveChange,
  filterSummarized,
  onSummarizedChange,
  filterShared,
  onSharedChange,
  filterSecurityContext,
  onSecurityContextChange,
  activeCategory,
  onCategoryChange,
  categories,
  categoryLabel,
}: {
  totalCount: number;
  postsCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  filterSite: string;
  onSiteChange: (value: string) => void;
  siteOptions: string[];
  filterDateFrom: string;
  onDateFromChange: (value: string) => void;
  filterDateTo: string;
  onDateToChange: (value: string) => void;
  filterCve: string;
  onCveChange: (value: string) => void;
  filterSummarized: boolean;
  onSummarizedChange: (value: boolean) => void;
  filterShared: boolean;
  onSharedChange: (value: boolean) => void;
  filterSecurityContext: boolean;
  onSecurityContextChange: (value: boolean) => void;
  activeCategory: number | null;
  onCategoryChange: (value: number | null) => void;
  categories: Category[];
  categoryLabel: string;
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ marginBottom: '0.5rem' }}>보안 인텔리전스 피드</h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                현재 조건 기준 {totalCount.toLocaleString()}건 중 {postsCount.toLocaleString()}건 로드됨
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 24, padding: '0 16px', width: 320 }}>
                <input
                  type="text"
                  placeholder="키워드로 검색"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  style={{ width: '100%', padding: '10px 0', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem' }}
                />
              </div>
              <button className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'}`} onClick={onToggleFilters} style={{ borderRadius: 24, padding: '8px 20px', fontSize: '0.9rem' }}>
                {showFilters ? '필터 닫기' : '고급 필터'}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>출처 사이트</label>
                <select value={filterSite} onChange={(event) => onSiteChange(event.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 10, fontSize: '0.9rem', outline: 'none' }}>
                  <option value="">모든 사이트</option>
                  {siteOptions.map((site) => <option key={site} value={site}>{site}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>시작일</label>
                <input type="date" value={filterDateFrom} onChange={(event) => onDateFromChange(event.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '9px 14px', borderRadius: 10, fontSize: '0.9rem', outline: 'none', colorScheme: 'dark' }} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>종료일</label>
                <input type="date" value={filterDateTo} onChange={(event) => onDateToChange(event.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '9px 14px', borderRadius: 10, fontSize: '0.9rem', outline: 'none', colorScheme: 'dark' }} />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>CVE ID</label>
                <input type="text" value={filterCve} onChange={(event) => onCveChange(event.target.value)} placeholder="CVE-2025-12345" style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '9px 14px', borderRadius: 10, fontSize: '0.9rem', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', paddingBottom: '0.5rem', flex: '1 1 340px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: '0.95rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={filterSecurityContext} onChange={(event) => onSecurityContextChange(event.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                  <span>보안 맥락 포함</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: '0.95rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={filterSummarized} onChange={(event) => onSummarizedChange(event.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                  <span>AI 요약만</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: '0.95rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={filterShared} onChange={(event) => onSharedChange(event.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                  <span>공유 글만</span>
                </label>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className={`btn ${activeCategory === null ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => onCategoryChange(null)}>전체</button>
            {categories.map((category) => (
              <button key={category.id} className={`btn ${activeCategory === category.id ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => onCategoryChange(category.id)}>
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>현재 카테고리: {categoryLabel}</div>
    </>
  );
}
