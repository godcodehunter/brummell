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
import { stringifyDuration, stringifyTime } from '../utilsTime';

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
                        {/* <Markdown components={mdComponents}>{md}</Markdown> */}
                    </section>
                    {node.tag === NodeTag.Category && node.children.length > 0 && (
                        <SectionTree nodes={node.children} depth={depth + 1} />
                    )}
                </React.Fragment>
            );
        })}
    </>
);

const ArticleBodyOld: React.FC = () => <SectionTree nodes={tocStub} depth={0} />;

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
query GetArticle {
    getArticle {
        id
        kicker
        headline
        illustration
        difficulty
        preview_txt
        reading_time_min
        createdAt
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

    // Still fetching — don't redirect prematurely.
    if (hasValidId && loading) {
        return null;
    }

    // Invalid id, request failed, or no podcast with this id.
    if (!hasValidId || error || !data?.getArticle) {
        return <Navigate to="/error" replace />;
    }

    const { messages, sendMessage } = useChat("article", id);

    const { kicker, views, headline, illustration, difficulty, preview_txt, reading_time_min, createdAt, ribbon, tags } = data.getArticle;

    // const ArticleBody = React.useMemo(() => getMDXComponent(code), [code])
    const middlePanelRef = useRef<HTMLDivElement>(null);
    const sectionIds = useMemo(
        () => flattenForScroll(tocStub).map(s => s.id),
        []
    );
    const { activeId, visibleIds } = useScrollState(middlePanelRef, sectionIds);

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
                        bage: ribbon,
                        kicker: kicker,
                        title: headline,
                        preview: preview_txt,
                        tags: tags,
                        imageSrc: illustration,
                        metaItems: {
                            difficulty: difficulty,
                            readingTime: stringifyDuration(reading_time_min),
                            views: views.toString(),
                            publishedAt: stringifyTime(createdAt),
                        },
                    }}
                />
                <div
                    className={css(globalStyles.substrate)}
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