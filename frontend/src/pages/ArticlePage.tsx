import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown'
import chroma from 'chroma-js';
import { palette } from '../globalStyles';
import { globalStyles, constants } from '../globalStyles';
import { StyleSheet, css } from 'aphrodite';
import { Category, Item, Node, NodeTag, TreeCard } from '../components/TreeCard';
import { Chat, ChatMessage } from '../components/Chat';
import { useChat, ChatComment } from '../chatQueries';
import { ReactComponent as Clock } from './assets/clock.svg';
import { ReactComponent as Calendar } from './assets/calendar.svg';
import { ReactComponent as Eye } from './assets/eye.svg';
import { ReactComponent as Lvl } from './assets/lvl.svg';
import { ArticleHead } from '../components/ArticleHead';
import BackToMain from '../components/BackToMain';

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

const HERO_IMAGE = 'data:image/jpeg;base64,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';

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

const itemMarkdown = (label: string) => `
We turn now to **${label}**, considered from several angles before the synthesis at the end of this section.

Key observations:

- First angle: how *${label}* appears in practice, where the assumptions of the previous chapter no longer hold.
- Second angle: the trade-offs unique to ${label} — bounded recall vs. unbounded latency, and the cost of refusing either.
- Third angle: where ${label} interacts with adjacent concerns (caching, retries, idempotency).

A short illustration:

\`\`\`ts
function evaluate(input: Input): Result {
    // hot path for ${label}
    const ctx = prepare(input);
    return ctx.kind === "fast"
        ? analyzeFast(ctx)
        : analyze(ctx);
}
\`\`\`

> Authors disagree on the precise framing of **${label}**. The treatment here favours clarity over completeness; readers wanting a more rigorous account should consult the appendix.

Looking ahead, **${label}** sets up the discussion of subsequent sections, where the implications become more concrete. The remaining paragraphs collect supplementary notes that did not fit the main flow.

A second pass over the same material, with more emphasis on edge cases: when ${label} appears alongside concurrent constraints, the picture changes. Most treatments gloss over this — we will not.

The reframing: rather than treating ${label} as a static property, view it as a process. Each invariant we previously described as fixed can instead be examined as a dynamic equilibrium. This perspective dissolves several apparent paradoxes and motivates the construction of the next section.

One last note before moving on. The shorthand \`${label.toLowerCase().replace(/\s+/g, "_")}\` will recur in code samples below; treat it as the canonical identifier.
`;

const categoryMarkdown = (label: string) => `
This part covers **${label}**. Each subsection takes one facet and develops it independently; readers comfortable with ${label} may skim the lead-in and jump straight to the topic of interest.
`;

const markdownBody = StyleSheet.create({
    p: {
        fontFamily: "Roboto",
        fontSize: 14,
        lineHeight: 1.6,
        color: "#D4D4D4",
        marginTop: 0,
        marginBottom: 12,
    },
    ul: {
        color: "#D4D4D4",
        fontFamily: "Roboto",
        fontSize: 14,
        lineHeight: 1.6,
        paddingLeft: 24,
        marginTop: 0,
        marginBottom: 12,
    },
    ol: {
        color: "#D4D4D4",
        fontFamily: "Roboto",
        fontSize: 14,
        lineHeight: 1.6,
        paddingLeft: 24,
        marginTop: 0,
        marginBottom: 12,
    },
    li: {
        marginBottom: 4,
    },
    inlineCode: {
        fontFamily: "monospace",
        fontSize: 13,
        backgroundColor: "#1E1E1F",
        color: "#FFB87A",
        padding: "2px 6px",
        borderRadius: 2,
    },
    pre: {
        backgroundColor: "#1E1E1F",
        padding: 12,
        marginTop: 0,
        marginBottom: 16,
        overflowX: "auto",
        fontFamily: "monospace",
        fontSize: 13,
        color: "#D4D4D4",
        borderLeft: "3px solid #4A9EFF",
    },
    blockquote: {
        borderLeft: "3px solid #585858",
        paddingLeft: 12,
        margin: "12px 0",
        color: "#ABABAB",
        fontStyle: "italic",
    },
    strong: {
        fontWeight: "bold",
        color: "#FFFFFF",
    },
});

const mdComponents = {
    p: ({ children }: any) => <p className={css(markdownBody.p)}>{children}</p>,
    ul: ({ children }: any) => <ul className={css(markdownBody.ul)}>{children}</ul>,
    ol: ({ children }: any) => <ol className={css(markdownBody.ol)}>{children}</ol>,
    li: ({ children }: any) => <li className={css(markdownBody.li)}>{children}</li>,
    pre: ({ children }: any) => <pre className={css(markdownBody.pre)}>{children}</pre>,
    // Inside <pre>, react-markdown gives <code> a `language-*` className; outside it's bare.
    code: ({ children, className }: any) =>
        className?.startsWith("language-")
            ? <code className={className}>{children}</code>
            : <code className={css(markdownBody.inlineCode)}>{children}</code>,
    blockquote: ({ children }: any) => <blockquote className={css(markdownBody.blockquote)}>{children}</blockquote>,
    strong: ({ children }: any) => <strong className={css(markdownBody.strong)}>{children}</strong>,
};

const sectionStyles = StyleSheet.create({
    section: {
        scrollMarginTop: 80,
        marginBottom: 24,
    },
    h2: {
        fontFamily: "Monda",
        fontSize: 22,
        fontWeight: "bold",
        color: "#D4D4D4",
        marginTop: 32,
        marginBottom: 8,
    },
    h3: {
        fontFamily: "Monda",
        fontSize: 16,
        fontWeight: "bold",
        color: "#D4D4D4",
        marginTop: 20,
        marginBottom: 6,
    },
    p: {
        fontFamily: "Roboto",
        fontSize: 14,
        lineHeight: 1.6,
        color: "#D4D4D4",
        marginBottom: 12,
    },
});

const headingStyle = (depth: number): React.CSSProperties => ({
    fontFamily: "Monda",
    fontSize: Math.max(13, 24 - depth * 2),
    fontWeight: "bold",
    color: "#D4D4D4",
    marginTop: depth === 0 ? 32 : 20,
    marginBottom: 8,
});

const SectionTree: React.FC<{ nodes: Node[], depth: number }> = ({ nodes, depth }) => (
    <>
        {nodes.map(node => {
            const HeadingTag = (`h${Math.min(depth + 2, 6)}` as React.ElementType);
            const md = node.tag === NodeTag.Category ? categoryMarkdown(node.label) : itemMarkdown(node.label);
            return (
                <React.Fragment key={node.id}>
                    <section id={node.id} className={css(sectionStyles.section)}>
                        <HeadingTag style={headingStyle(depth)}>{node.label}</HeadingTag>
                        <Markdown components={mdComponents}>{md}</Markdown>
                    </section>
                    {node.tag === NodeTag.Category && node.children.length > 0 && (
                        <SectionTree nodes={node.children} depth={depth + 1} />
                    )}
                </React.Fragment>
            );
        })}
    </>
);

const ArticleBody: React.FC = () => <SectionTree nodes={tocStub} depth={0} />;

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

export const ArticlePage = () => {
    const middlePanelRef = useRef<HTMLDivElement>(null);
    const sectionIds = useMemo(
        () => flattenForScroll(tocStub).map(s => s.id),
        []
    );
    const { activeId, visibleIds } = useScrollState(middlePanelRef, sectionIds);

    // Hardcoded article id for now — the /article route does not carry one
    // in the URL yet. Switch to a route param once that's wired up.
    const { messages, sendMessage } = useChat("article", 1);

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
                        bage: "new",
                        kicker: "Systems",
                        title: "Article Title",
                        preview: "A short overview of the piece — the kind of lead-in you'd see hovering over the card on the main page. Two or three sentences setting up what the article covers and why it matters.",
                        tags: [
                            { label: "concurrency", color: chroma("#7AB8FF"), tooltip: "concurrency" },
                            { label: "memory model", color: chroma("#FFB87A"), tooltip: "memory model" },
                            { label: "performance", color: chroma("#7AFFB8"), tooltip: "performance" },
                        ],
                        imageSrc: HERO_IMAGE,
                        metaItems: {
                            difficulty: "hard",
                            readingTime: "8 min read",
                            views: "42",
                            publishedAt: "today at 14:32",
                        },
                    }}
                />
                <div
                    className={css(globalStyles.substrate)}
                    style={{
                        padding: constants.gap,
                    }}
                >
                    <ArticleBody />
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