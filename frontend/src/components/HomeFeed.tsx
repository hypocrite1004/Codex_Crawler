"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchCategories, fetchPostFeed, type Category, type PostListItem } from "@/lib/api";

const PAGE_SIZE = 24;
const GRID_GAP = 24;
const CARD_MIN_WIDTH = 320;
const ROW_HEIGHT = 360;
const OVERSCAN_ROWS = 3;

function dedupePosts(items: PostListItem[]) {
    const seen = new Set<number>();
    return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

export default function HomeFeed() {
    const [posts, setPosts] = useState<PostListItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [siteOptions, setSiteOptions] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<number | null>(null);
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [viewportState, setViewportState] = useState({ scrollTop: 0, viewportHeight: 0 });

    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [filterSite, setFilterSite] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterCve, setFilterCve] = useState("");
    const [filterSummarized, setFilterSummarized] = useState(false);
    const [filterShared, setFilterShared] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const gridRef = useRef<HTMLDivElement | null>(null);
    const loadingMoreRef = useRef(false);

    const resetFeed = () => {
        setPosts([]);
        setPage(1);
        setHasMore(false);
        setLoadingInitial(true);
        setLoadingMore(false);
    };

    useEffect(() => {
        loadingMoreRef.current = loadingMore;
    }, [loadingMore]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            resetFeed();
            setDebouncedQuery(searchQuery.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        fetchCategories().then(setCategories);
    }, []);

    useEffect(() => {
        const updateViewport = () => {
            if (!gridRef.current) return;
            const rect = gridRef.current.getBoundingClientRect();
            const absoluteTop = rect.top + window.scrollY;
            setViewportState({
                scrollTop: Math.max(0, window.scrollY - absoluteTop),
                viewportHeight: window.innerHeight,
            });
        };

        const onScroll = () => window.requestAnimationFrame(updateViewport);
        const onResize = () => window.requestAnimationFrame(updateViewport);

        updateViewport();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onResize);
        };
    }, []);

    useEffect(() => {
        if (!gridRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setContainerWidth(entry.contentRect.width);
        });
        observer.observe(gridRef.current);
        return () => observer.disconnect();
    }, []);

    const requestFilters = useMemo(() => {
        const params: Record<string, string> = {};
        if (debouncedQuery) params.search = debouncedQuery;
        if (filterSite) params.site = filterSite;
        if (filterDateFrom) params.start_date = filterDateFrom;
        if (filterDateTo) params.end_date = filterDateTo;
        if (filterCve.trim()) params.cve = filterCve.trim();
        if (filterSummarized) params.is_summarized = "true";
        if (filterShared) params.is_shared = "true";
        if (activeCategory) params.category = String(activeCategory);
        return params;
    }, [activeCategory, debouncedQuery, filterCve, filterDateFrom, filterDateTo, filterShared, filterSite, filterSummarized]);

    const requestKey = useMemo(() => JSON.stringify(requestFilters), [requestFilters]);

    useEffect(() => {
        let cancelled = false;
        fetchPostFeed(requestFilters, 1, PAGE_SIZE)
            .then((response) => {
                if (cancelled) return;
                setPosts(response.results);
                setSiteOptions(response.site_options);
                setTotalCount(response.count);
                setHasMore(Boolean(response.next));
            })
            .finally(() => {
                if (!cancelled) setLoadingInitial(false);
            });
        return () => {
            cancelled = true;
        };
    }, [requestFilters, requestKey]);

    useEffect(() => {
        if (page === 1) return;
        let cancelled = false;
        fetchPostFeed(requestFilters, page, PAGE_SIZE)
            .then((response) => {
                if (cancelled) return;
                setPosts((current) => dedupePosts([...current, ...response.results]));
                setHasMore(Boolean(response.next));
                setTotalCount(response.count);
            })
            .finally(() => {
                if (!cancelled) setLoadingMore(false);
            });
        return () => {
            cancelled = true;
        };
    }, [page, requestFilters, requestKey]);

    useEffect(() => {
        const node = sentinelRef.current;
        if (!node || !hasMore || loadingInitial) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0]?.isIntersecting || loadingMoreRef.current) return;
                setLoadingMore(true);
                setPage((current) => current + 1);
            },
            { rootMargin: "800px 0px" },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, loadingInitial]);

    const columnCount = useMemo(() => {
        if (containerWidth <= 0) return 1;
        return Math.max(1, Math.floor((containerWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)));
    }, [containerWidth]);

    const totalRows = Math.ceil(posts.length / columnCount);
    const visibleRowStart = Math.max(0, Math.floor(viewportState.scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
    const visibleRowEnd = Math.min(
        totalRows,
        Math.ceil((viewportState.scrollTop + viewportState.viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
    );
    const visibleStartIndex = visibleRowStart * columnCount;
    const visibleEndIndex = Math.min(posts.length, visibleRowEnd * columnCount);
    const visiblePosts = posts.slice(visibleStartIndex, visibleEndIndex);
    const virtualHeight = Math.max(totalRows * ROW_HEIGHT, ROW_HEIGHT);
    const translateY = visibleRowStart * ROW_HEIGHT;

    const categoryLabel = activeCategory === null
        ? "전체"
        : categories.find((category) => category.id === activeCategory)?.name || "선택됨";

    const highlightText = (text: string, query: string) => {
        if (!query.trim()) return text;
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
        return (
            <>
                {parts.map((part, index) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <mark key={`${part}-${index}`} style={{ background: "rgba(14,165,233,0.25)", color: "#38bdf8", padding: "0 2px", borderRadius: 4, fontWeight: 600 }}>
                            {part}
                        </mark>
                    ) : part,
                )}
            </>
        );
    };

    const triggerReset = <T,>(setter: (value: T) => void, value: T) => {
        resetFeed();
        setter(value);
    };

    if (loadingInitial && posts.length === 0) {
        return <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>게시글을 불러오는 중입니다...</div>;
    }

    return (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                        <div>
                            <h2 style={{ marginBottom: "0.5rem" }}>보안 인텔리전스 피드</h2>
                            <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                                현재 조건 기준 {totalCount.toLocaleString()}건 중 {posts.length.toLocaleString()}건 로드됨
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", background: "var(--bg-secondary)", border: "1px solid var(--glass-border)", borderRadius: 24, padding: "0 16px", width: 320 }}>
                                <input
                                    type="text"
                                    placeholder="키워드로 검색"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    style={{ width: "100%", padding: "10px 0", background: "transparent", border: "none", color: "var(--text-primary)", outline: "none", fontSize: "0.9rem" }}
                                />
                            </div>
                            <button className={`btn ${showFilters ? "btn-primary" : "btn-outline"}`} onClick={() => setShowFilters((current) => !current)} style={{ borderRadius: 24, padding: "8px 20px", fontSize: "0.9rem" }}>
                                {showFilters ? "필터 닫기" : "고급 필터"}
                            </button>
                        </div>
                    </div>

                    {showFilters && (
                        <div className="glass-panel" style={{ marginTop: "1.5rem", padding: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-end" }}>
                            <div style={{ flex: "1 1 180px" }}>
                                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem", fontWeight: 500 }}>출처 사이트</label>
                                <select value={filterSite} onChange={(event) => triggerReset(setFilterSite, event.target.value)} style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", padding: "10px 14px", borderRadius: 10, fontSize: "0.9rem", outline: "none" }}>
                                    <option value="">모든 사이트</option>
                                    {siteOptions.map((site) => <option key={site} value={site}>{site}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: "1 1 150px" }}>
                                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem", fontWeight: 500 }}>시작일</label>
                                <input type="date" value={filterDateFrom} onChange={(event) => triggerReset(setFilterDateFrom, event.target.value)} style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", padding: "9px 14px", borderRadius: 10, fontSize: "0.9rem", outline: "none", colorScheme: "dark" }} />
                            </div>
                            <div style={{ flex: "1 1 150px" }}>
                                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem", fontWeight: 500 }}>종료일</label>
                                <input type="date" value={filterDateTo} onChange={(event) => triggerReset(setFilterDateTo, event.target.value)} style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", padding: "9px 14px", borderRadius: 10, fontSize: "0.9rem", outline: "none", colorScheme: "dark" }} />
                            </div>
                            <div style={{ flex: "1 1 180px" }}>
                                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem", fontWeight: 500 }}>CVE ID</label>
                                <input type="text" value={filterCve} onChange={(event) => triggerReset(setFilterCve, event.target.value)} placeholder="CVE-2025-12345" style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", padding: "9px 14px", borderRadius: 10, fontSize: "0.9rem", outline: "none" }} />
                            </div>
                            <div style={{ display: "flex", gap: "1.5rem", paddingBottom: "0.5rem", flex: "1 1 220px", alignItems: "center" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontSize: "0.95rem", cursor: "pointer", userSelect: "none" }}>
                                    <input type="checkbox" checked={filterSummarized} onChange={(event) => triggerReset(setFilterSummarized, event.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent-primary)", cursor: "pointer" }} />
                                    <span>AI 요약만</span>
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontSize: "0.95rem", cursor: "pointer", userSelect: "none" }}>
                                    <input type="checkbox" checked={filterShared} onChange={(event) => triggerReset(setFilterShared, event.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent-primary)", cursor: "pointer" }} />
                                    <span>공유 글만</span>
                                </label>
                            </div>
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
                        <button className={`btn ${activeCategory === null ? "btn-primary" : "btn-outline"}`} style={{ padding: "6px 14px", fontSize: "0.85rem" }} onClick={() => triggerReset(setActiveCategory, null)}>전체</button>
                        {categories.map((category) => (
                            <button key={category.id} className={`btn ${activeCategory === category.id ? "btn-primary" : "btn-outline"}`} style={{ padding: "6px 14px", fontSize: "0.85rem" }} onClick={() => triggerReset(setActiveCategory, category.id)}>
                                {category.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ color: "var(--text-secondary)", marginBottom: "1rem", fontSize: "0.9rem" }}>현재 카테고리: {categoryLabel}</div>

            {posts.length > 0 ? (
                <div ref={gridRef} style={{ position: "relative", minHeight: 480, height: virtualHeight }}>
                    <div style={{ position: "absolute", top: translateY, left: 0, right: 0, display: "grid", gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, gap: GRID_GAP }}>
                        {visiblePosts.map((post) => (
                            <Link href={`/posts/${post.id}`} key={post.id} style={{ textDecoration: "none" }}>
                                <article className="glass-panel" style={{ cursor: "pointer", height: ROW_HEIGHT - GRID_GAP, display: "flex", flexDirection: "column", overflow: "hidden", contentVisibility: "auto" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                                        <div style={{ color: "var(--accent-secondary)", fontSize: "0.85rem", fontWeight: 600 }}>{post.category_name || "미분류"}</div>
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                            {post.cve_count > 0 && <div style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem", fontWeight: "bold" }}>CVE {post.cve_count}</div>}
                                            {post.is_shared && <div style={{ background: "var(--accent-primary)", color: "white", padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem", fontWeight: "bold" }}>Shared</div>}
                                        </div>
                                    </div>

                                    <h3 style={{ fontSize: "1.2rem", color: "var(--text-primary)", marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 58 }}>
                                        {highlightText(post.title, debouncedQuery)}
                                    </h3>
                                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 16, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 96 }}>
                                        {highlightText(post.content_preview, debouncedQuery)}
                                    </p>

                                    <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.85rem", color: "var(--text-secondary)", minWidth: 0 }}>
                                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>
                                                {post.author?.username ? post.author.username.charAt(0).toUpperCase() : "?"}
                                            </div>
                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {post.author?.username || "Unknown"} · {new Date(post.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {post.related_count > 0 && <span style={{ fontSize: "0.75rem", color: "#8b5cf6", background: "rgba(139,92,246,0.15)", padding: "2px 8px", borderRadius: 12, fontWeight: 600, flexShrink: 0 }}>+ {post.related_count} 연관 글</span>}
                                    </div>
                                </article>
                            </Link>
                        ))}
                    </div>
                </div>
            ) : (
                <div ref={gridRef} style={{ color: "var(--text-secondary)", textAlign: "center", padding: "40px 0" }}>
                    현재 조건에 맞는 게시글이 없습니다.
                </div>
            )}

            <div ref={sentinelRef} style={{ height: 1 }} />

            {(loadingMore || loadingInitial) && posts.length > 0 && (
                <div style={{ marginTop: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>게시글을 더 불러오는 중입니다...</div>
            )}
            {!hasMore && posts.length > 0 && (
                <div style={{ marginTop: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>마지막 게시글까지 모두 확인했습니다.</div>
            )}
        </>
    );
}
