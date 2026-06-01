import React, { useEffect, useMemo, useRef, useState } from 'react';
import chroma from 'chroma-js';
import { palette } from '../globalStyles';
import { globalStyles, constants } from '../globalStyles';
import { StyleSheet, css } from 'aphrodite';
import { Node, NodeTag, TreeCard } from '../components/TreeCard';
import { Chat } from '../components/Chat';
import { useChat } from '../chatQueries';
import { ArticleHead } from '../components/ArticleHead';
import BackToMain from '../components/BackToMain';
import { getMDXComponent } from 'mdx-bundler/client'
import { gql, useQuery } from "@apollo/client";
import { Navigate, useSearchParams } from 'react-router-dom';
import { DateTime, Duration } from 'luxon';
import { stringifyDuration, stringifyTime } from '../utilsTime';
import '../index.css';

const page = StyleSheet.create({
    root: {
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
        backgroundColor: palette.mainColor,
        boxSizing: "border-box",
    },
    leftPanel: {
        flex: "0 0 300px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        paddingTop: constants.gap,
        paddingLeft: constants.gap,
        paddingBottom: constants.gap,
        gap: constants.gap,
        boxSizing: "border-box",
        minHeight: 0,
        overflow: "hidden",
    },
    middlePanel: {
        flex: "1 1 0",
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        paddingTop: constants.gap,
        paddingLeft: constants.gap,
        paddingRight: constants.gap,
        paddingBottom: constants.gap,
        display: "flex",
        flexDirection: "column",
        gap: constants.gap,
        boxSizing: "border-box",
        minWidth: 0,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "::-webkit-scrollbar": {
            display: "none",
        },
    },
    rightPanel: {
        flex: "0 0 340px",
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        paddingTop: constants.gap,
        paddingRight: constants.gap,
        paddingBottom: constants.gap,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
    },
});

// Walk the TOC in document order. Categories and items both produce sections
// (a Category section is the heading + lead-in, then its child items follow).
const flattenForScroll = (nodes: Node[]): { id: string, level: number, label: string }[] => {
    const out: { id: string, level: number, label: string }[] = [];
    const walk = (ns: Node[], level: number) => {
        for (const n of ns) {
            out.push({ id: n.id, level, label: n.label });
            if (n.tag === NodeTag.Category) walk(n.children, level + 1);
        }
    };
    walk(nodes, 0);
    return out;
};

const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Reads the rendered article DOM, finds every h1..h6, makes sure each one
// has an `id` (so the TOC click can scroll to it), and folds the flat list
// into a nested Node tree by heading level. A heading with deeper headings
// after it becomes a Category; a heading with none becomes an Item.
const buildTocFromDOM = (root: HTMLElement): Node[] => {
    const headings = Array.from(
        root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
    );
    if (headings.length === 0) return [];

    type Frame = { id: string, label: string, level: number, children: Frame[] };
    const flat: Frame[] = headings.map((el, i) => {
        const level = Number(el.tagName[1]);
        const label = (el.textContent ?? '').trim() || `Section ${i + 1}`;
        if (!el.id) el.id = `h-${slugify(label) || 'section'}-${i}`;
        return { id: el.id, label, level, children: [] };
    });

    const sentinel: Frame = { id: '', label: '', level: 0, children: [] };
    const stack: Frame[] = [sentinel];
    for (const node of flat) {
        while (stack[stack.length - 1].level >= node.level) stack.pop();
        stack[stack.length - 1].children.push(node);
        stack.push(node);
    }

    const toNodes = (frames: Frame[]): Node[] =>
        frames.map(f => f.children.length > 0
            ? { tag: NodeTag.Category, id: f.id, label: f.label, children: toNodes(f.children) }
            : { tag: NodeTag.Item, id: f.id, label: f.label });
    return toNodes(sentinel.children);
};


// Active = section whose body covers the reading point at ~40% of the
// viewport height. Picking a point well below the top edge means the
// highlighted item matches what the user is actually looking at, not the
// section whose heading just barely scrolled past the top.
const READING_POINT_RATIO = 0.4;

interface ScrollState {
    activeId: string | undefined;
    visibleIds: string[];
}

const useScrollState = (
    scrollerRef: React.RefObject<HTMLElement>,
    sectionIds: string[],
): ScrollState => {
    const [state, setState] = useState<ScrollState>({ activeId: sectionIds[0], visibleIds: [] });
    const idsKey = sectionIds.join("|");

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;

        let pending = false;
        const compute = () => {
            pending = false;
            const scrollerRect = scroller.getBoundingClientRect();
            const readingPoint = scrollerRect.height * READING_POINT_RATIO;
            let activeCandidate: string | undefined = sectionIds[0];
            const visible: string[] = [];
            for (const id of sectionIds) {
                const el = scroller.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
                if (!el) continue;
                const rect = el.getBoundingClientRect();
                const offsetTop = rect.top - scrollerRect.top;
                const offsetBottom = rect.bottom - scrollerRect.top;
                if (offsetBottom > 0 && offsetTop < scrollerRect.height) {
                    visible.push(id);
                }
                if (offsetTop <= readingPoint) {
                    activeCandidate = id;
                }
            }
            setState(prev => {
                const sameActive = prev.activeId === activeCandidate;
                const sameVisible = prev.visibleIds.length === visible.length
                    && prev.visibleIds.every((v, i) => v === visible[i]);
                if (sameActive && sameVisible) return prev;
                return { activeId: activeCandidate, visibleIds: sameVisible ? prev.visibleIds : visible };
            });
        };

        const onScroll = () => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(compute);
        };

        compute();
        scroller.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            scroller.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollerRef, idsKey]);

    return state;
};

const GET_ARTICLE = gql`
query GetArticle($id: Int!) {
    getArticle(id: $id) {
        id
        kicker
        headline
        illustration
        difficulty
        preview_txt
        reading_time_min
        createdAt
        views
        ribbon
        code
        tags {
            id
            label
            color
            tooltip
        }
    }
}
`;

export const ArticlePage = () => {
    const [searchParams] = useSearchParams();
    const id = Number(searchParams.get("id"));

    const hasValidId = Number.isInteger(id) && id > 0;

    const { data, loading, error } = useQuery(GET_ARTICLE, {
        variables: { id },
        skip: !hasValidId,
    });

    const { messages, sendMessage } = useChat("article", id);

    const code: string | null = data?.getArticle?.code ?? null;
    const ArticleBody = React.useMemo(
        () => (code ? getMDXComponent(code) : null),
        [code],
    );
    const middlePanelRef = useRef<HTMLDivElement>(null);
    const articleBodyRef = useRef<HTMLDivElement>(null);
    const [toc, setToc] = useState<Node[]>([]);

    // Build the TOC by reflecting over the rendered article DOM: every time
    // ArticleBody changes we re-scan the body for h1..h6, give them ids, and
    // fold the flat list into a nested tree by heading level.
    useEffect(() => {
        const root = articleBodyRef.current;
        if (!root || !ArticleBody) {
            setToc([]);
            return;
        }
        setToc(buildTocFromDOM(root));
    }, [ArticleBody]);

    const sectionIds = useMemo(
        () => flattenForScroll(toc).map(s => s.id),
        [toc],
    );
    const { activeId, visibleIds } = useScrollState(middlePanelRef, sectionIds);

    // Still fetching — don't redirect prematurely.
    if (hasValidId && loading) {
        return null;
    }

    // Invalid id, request failed, or no podcast with this id.
    if (!hasValidId || error || !data?.getArticle) {
        console.log("Article loading error:", error);
        return <Navigate to="/error" replace />;
    }

    return (
        <div className={css(page.root)}>
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <div className={css(page.leftPanel)}>
                <BackToMain />
                <TreeCard
                    title={"CONTENTS"}
                    data={toc}
                    activeId={activeId}
                    expandIds={visibleIds}
                    onNodeClick={(node) => {
                        const scroller = middlePanelRef.current;
                        const target = scroller?.querySelector(`#${CSS.escape(node.id)}`) as HTMLElement | null;
                        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                />
            </div>
            <div ref={middlePanelRef} className={css(page.middlePanel)}>
                <ArticleHead
                    article={{
                        bage: data.getArticle.ribbon,
                        kicker: data.getArticle.kicker,
                        title: data.getArticle.headline,
                        preview: data.getArticle.preview_txt,
                        // Server returns color as a hex string; Chip wants a
                        // chroma.Color instance (it calls .hex() on it).
                        tags: data.getArticle.tags.map((t: { label: string, color: string, tooltip: string }) => ({
                            label: t.label,
                            color: chroma(t.color || "#888888"),
                            tooltip: t.tooltip,
                        })),
                        imageSrc: data.getArticle.illustration,
                        metaItems: {
                            difficulty: data.getArticle.difficulty,
                            readingTime: stringifyDuration(Duration.fromObject({ minutes: data.getArticle.reading_time_min })),
                            views: data.getArticle.views.toString(),
                            publishedAt: stringifyTime(DateTime.fromSeconds(data.getArticle.createdAt)),
                        },
                    }}
                />
                <div
                    ref={articleBodyRef}
                    className={`${css(globalStyles.substrate)} article-section`}
                    style={{
                        padding: constants.gap,
                    }}
                >
                    {ArticleBody && <ArticleBody />}
                </div>
                {/* 
                    A placeholder that allows you to raise the article 
                    by another half of the screen 
                */}
                <div style={{ height: "50vh", flexShrink: 0 }} />
            </div>
            <div className={css(page.rightPanel)}>
                <Chat messages={messages} onSend={sendMessage} />
            </div>
        </div>
    );
};