"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { fetchCategories, fetchPostFeed, type Category, type PostListItem } from "@/lib/api";
import HomeFeedFilters from "./HomeFeedFilters";
import HomeFeedGrid from "./HomeFeedGrid";

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
            <HomeFeedFilters
                totalCount={totalCount}
                postsCount={posts.length}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters((current) => !current)}
                filterSite={filterSite}
                onSiteChange={(value) => triggerReset(setFilterSite, value)}
                siteOptions={siteOptions}
                filterDateFrom={filterDateFrom}
                onDateFromChange={(value) => triggerReset(setFilterDateFrom, value)}
                filterDateTo={filterDateTo}
                onDateToChange={(value) => triggerReset(setFilterDateTo, value)}
                filterCve={filterCve}
                onCveChange={(value) => triggerReset(setFilterCve, value)}
                filterSummarized={filterSummarized}
                onSummarizedChange={(value) => triggerReset(setFilterSummarized, value)}
                filterShared={filterShared}
                onSharedChange={(value) => triggerReset(setFilterShared, value)}
                activeCategory={activeCategory}
                onCategoryChange={(value) => triggerReset(setActiveCategory, value)}
                categories={categories}
                categoryLabel={categoryLabel}
            />

            <HomeFeedGrid
                posts={posts}
                visiblePosts={visiblePosts}
                debouncedQuery={debouncedQuery}
                columnCount={columnCount}
                gridRef={gridRef}
                sentinelRef={sentinelRef}
                virtualHeight={virtualHeight}
                translateY={translateY}
                rowHeight={ROW_HEIGHT}
                gridGap={GRID_GAP}
                hasMore={hasMore}
                loadingInitial={loadingInitial}
                loadingMore={loadingMore}
                highlightText={highlightText}
            />
        </>
    );
}
