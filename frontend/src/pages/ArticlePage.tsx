import React, { useEffect, useMemo, useRef, useState } from 'react';
import chroma from 'chroma-js';
import { palette } from '../globalStyles';
import { globalStyles, constants } from '../globalStyles';
import { StyleSheet, css } from 'aphrodite';
import { Category, Item, Node, NodeTag, TreeCard } from '../components/TreeCard';
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

const cat = (id: string, label: string, children: Node[]): Category => ({
    tag: NodeTag.Category,
    id,
    label,
    children,
});

const item = (id: string, label: string): Item => ({
    tag: NodeTag.Item,
    id,
    label,
});

const tocStub: Category[] = [
    cat("part-1", "Part 1: Survey", [
        cat("p1-c1", "Chapter 1: Foundations", [
            cat("p1-c1-s1", "1.1 Definitions", [
                cat("p1-c1-s1-ss1", "1.1.1 Core terms", [
                    cat("p1-c1-s1-ss1-sss1", "1.1.1.1 Primitives", [
                        cat("p1-c1-s1-ss1-sss1-ssss1", "1.1.1.1.1 Atoms", [
                            item("p1-c1-s1-ss1-sss1-ssss1-i1", "Quark"),
                            item("p1-c1-s1-ss1-sss1-ssss1-i2", "Lepton"),
                            item("p1-c1-s1-ss1-sss1-ssss1-i3", "Boson"),
                        ]),
                        cat("p1-c1-s1-ss1-sss1-ssss2", "1.1.1.1.2 Forces", [
                            item("p1-c1-s1-ss1-sss1-ssss2-i1", "Strong"),
                            item("p1-c1-s1-ss1-sss1-ssss2-i2", "Weak"),
                            item("p1-c1-s1-ss1-sss1-ssss2-i3", "Electromagnetic"),
                            item("p1-c1-s1-ss1-sss1-ssss2-i4", "Gravity"),
                        ]),
                        cat("p1-c1-s1-ss1-sss1-ssss3", "1.1.1.1.3 Fields", [
                            item("p1-c1-s1-ss1-sss1-ssss3-i1", "Higgs"),
                            item("p1-c1-s1-ss1-sss1-ssss3-i2", "Gauge"),
                        ]),
                        item("p1-c1-s1-ss1-sss1-i1", "Composition"),
                        item("p1-c1-s1-ss1-sss1-i2", "Decomposition"),
                    ]),
                    item("p1-c1-s1-ss1-i1", "Operators"),
                    item("p1-c1-s1-ss1-i2", "Relations"),
                ]),
                item("p1-c1-s1-i1", "Notation"),
                item("p1-c1-s1-i2", "Glossary"),
            ]),
            cat("p1-c1-s2", "1.2 Axioms", [
                item("p1-c1-s2-i1", "Reflexivity"),
                item("p1-c1-s2-i2", "Transitivity"),
            ]),
            item("p1-c1-i1", "Conventions"),
        ]),
        cat("p1-c2", "Chapter 2: Notation", [
            item("p1-c2-i1", "Symbols"),
            item("p1-c2-i2", "Indices"),
        ]),
        item("p1-i1", "Roadmap"),
    ]),
    cat("part-2", "Part 2: Method", [
        cat("p2-c1", "Chapter 1: Setup", [
            item("p2-c1-i1", "Environment"),
            item("p2-c1-i2", "Tooling"),
        ]),
        cat("p2-c2", "Chapter 2: Procedure", [
            cat("p2-c2-s1", "2.1 Pipeline", [
                item("p2-c2-s1-i1", "Inputs"),
                item("p2-c2-s1-i2", "Outputs"),
            ]),
            item("p2-c2-i1", "Validation"),
        ]),
    ]),
    cat("part-3", "Part 3: Discussion", [
        item("p3-i1", "Findings"),
        item("p3-i2", "Limitations"),
        item("p3-i3", "Open questions"),
    ]),
];

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

    // const ArticleBody = React.useMemo(() => getMDXComponent(code), [code])
    const middlePanelRef = useRef<HTMLDivElement>(null);
    const sectionIds = useMemo(
        () => flattenForScroll(tocStub).map(s => s.id),
        []
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
                    data={tocStub}
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
                        tags: data.getArticle.tags,
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
                    className={`${css(globalStyles.substrate)} article-section`}
                    style={{
                        padding: constants.gap,
                    }}
                >
                    {/* <ArticleBody /> */}
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