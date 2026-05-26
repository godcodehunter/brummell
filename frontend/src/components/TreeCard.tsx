import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, css } from 'aphrodite';
import { PlusInSquare, MinusInSquare } from '../assets/icons';
import { globalStyles, palette } from '../globalStyles';

const INDENT_STEP = 12;
const BASE_PADDING_X = 12;
const ROW_HEIGHT = 24;
const SCROLL_AREA_BG = "#1E1E1F";

const rowPadding = (depth: number) => ({
    paddingLeft: BASE_PADDING_X + depth * INDENT_STEP,
    paddingRight: BASE_PADDING_X,
    lineHeight: `${ROW_HEIGHT}px`,
});

const baseRow = StyleSheet.create({
    interactive: {
        cursor: "pointer",
        transition: "background-color 80ms ease-out",
        ":hover": {
            backgroundColor: "#3A3A3A",
        },
    },
    active: {
        backgroundColor: "#2A2A2A",
    },
});

const categoryRow = StyleSheet.create({
    row: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: SCROLL_AREA_BG,
    },
    // Sticky behavior is applied only to categories on the path to the active
    // item — sibling branches that happen to be open shouldn't compete for
    // sticky slots in the header stack. z-index is set inline per-row from
    // depth so outer (root-side) headers always paint above inner ones, even
    // mid-scroll when an inner row slides up through an outer's pinned slot.
    sticky: {
        position: "sticky",
    },
    // VSCode-style depth shadow — applied only when the header is actually
    // pinned (detected via scroll listener), not when it's at its natural row.
    stuck: {
        "::after": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            height: 6,
            background: "linear-gradient(rgba(0, 0, 0, 0.35), transparent)",
            pointerEvents: "none",
        },
    },
    label: {
        flexGrow: 1,
    },
    toggleIcon: {
        width: 14,
        height: 14,
        cursor: "pointer",
    },
    itemsCount: {
        color: "#858585",
        fontSize: 12,
    }
});

interface CategoryRowProps {
    nodeId: string,
    label: string,
    itemCount: number,
    onToggle: () => void,
    onClick?: () => void,
    onRightClick?: (e: React.MouseEvent) => void,
    isOpen: boolean,
    active: boolean,
    stuck: boolean,
    depth: number,
}

const GroupRow: React.FC<CategoryRowProps> = ({
    nodeId,
    label,
    itemCount,
    isOpen,
    onToggle,
    onClick,
    onRightClick,
    active,
    stuck,
    depth,
}) => {
    const Icon = isOpen ? MinusInSquare : PlusInSquare;
    // Sticky for any open category with rendered children — wrapper-scoped
    // sticky lets each subtree pin its header while its own children scroll,
    // and sibling subtrees take over as the user scrolls between them.
    const isSticky = isOpen && itemCount > 0;
    return (
        <div
            data-tree-node-id={nodeId}
            data-tree-category={isSticky ? "" : undefined}
            className={css(categoryRow.row, isSticky && categoryRow.sticky, stuck && categoryRow.stuck, onClick && baseRow.interactive, active && baseRow.active)}
            style={isSticky ? {...rowPadding(depth), top: depth * ROW_HEIGHT, zIndex: 100 - depth} : rowPadding(depth)}
            onClick={onClick}
            onContextMenu={onRightClick && ((e) => { e.preventDefault(); onRightClick(e); })}
        >
            <Icon
                className={css(categoryRow.toggleIcon)}
                //TODO: try move to style
                fill="#ABABAB"
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
            />
            <span className={css(categoryRow.label)}>
                {label}
            </span>
            <span className={css(categoryRow.itemsCount)}>
                {`[ ${itemCount} ]`}
            </span>
        </div>
    );
};

interface ContentRowProps {
    nodeId?: string,
    label: string,
    style?: any,
    onClick?: () => void,
    onRightClick?: (e: React.MouseEvent) => void,
    active?: boolean,
    depth?: number,
}

const ContentRow: React.FC<ContentRowProps> = ({nodeId, label, style, onClick, onRightClick, active, depth = 0}) => (
    <div
        data-tree-node-id={nodeId}
        className={css(onClick && baseRow.interactive, active && baseRow.active)}
        style={{...rowPadding(depth), ...style}}
        onClick={onClick}
        onContextMenu={onRightClick && ((e) => { e.preventDefault(); onRightClick(e); })}
    >
        {label}
    </div>
);

interface TreeProps {
    node: Node,
    Component: any,
    depth?: number,
    openIds: Set<string>,
    onToggle: (id: string) => void,
    highlightedIds: Set<string>,
    stuckIds: Set<string>,
}

const Tree = memo(({node, Component, depth = 0, openIds, onToggle, highlightedIds, stuckIds}: TreeProps) => {
    const isOpen = openIds.has(node.id);
    const renderedNode = (
        <Component
            node={node}
            isOpen={isOpen}
            depth={depth}
            active={highlightedIds.has(node.id)}
            stuck={stuckIds.has(node.id)}
            onToggle={() => onToggle(node.id)}
        />
    );
    if (node.tag !== NodeTag.Category) return renderedNode;
    // Wrap each Category subtree so position:sticky on the header is scoped
    // to this subtree's bounds — when scrolled past the wrapper, the header
    // releases instead of staying pinned over unrelated siblings.
    return (
        <div>
            {renderedNode}
            {isOpen && node.children.map((n) =>
                <Tree
                    key={n.id}
                    node={n}
                    Component={Component}
                    depth={depth + 1}
                    openIds={openIds}
                    onToggle={onToggle}
                    highlightedIds={highlightedIds}
                    stuckIds={stuckIds}
                />
            )}
        </div>
    );
});

export type Node = Category | Item;
export enum NodeTag {
    Category,
    Item,
}

export interface Category {
    tag: NodeTag.Category,
    id: string,
    label: string,
    children: Node[],
}

export interface Item {
    tag: NodeTag.Item,
    id: string,
    label: string,
}

const timelineCard = StyleSheet.create({
    content: {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
    },
    headline: {
        marginLeft: 8,
    },
    scrollArea: {
        backgroundColor: SCROLL_AREA_BG,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: "auto",
        minHeight: 0,
        paddingTop: 8,
        paddingBottom: 8,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
    },
});

// Returns the path from the root to `targetId` inclusive, or null if not found.
function findPath(nodes: Node[], targetId: string, acc: string[] = []): string[] | null {
    for (const n of nodes) {
        const here = [...acc, n.id];
        if (n.id === targetId) return here;
        if (n.tag === NodeTag.Category) {
            const p = findPath(n.children, targetId, here);
            if (p !== null) return p;
        }
    }
    return null;
}

interface TreeCardProps {
    data: Node[],
    title: string,
    style?: any,
    onNodeClick?: (node: Node) => void,
    onNodeRightClick?: (node: Node, e: React.MouseEvent) => void,
    activeId?: string,
    // Ids whose ancestor path should be force-expanded. Anything not on the
    // expansion union (∪ of paths to each id, plus activeId's path) is closed.
    expandIds?: string[],
}

export const TreeCard: React.FC<TreeCardProps> = ({data, title, style = {}, onNodeClick, onNodeRightClick, activeId, expandIds}) => {
    const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
    const [stuckIds, setStuckIds] = useState<Set<string>>(() => new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    // Detect pinned sticky headers, then keep only those that are EITHER:
    //   (a) the deepest pinned in their chain — the row directly under them
    //       is real scrolling content (items), or
    //   (b) themselves in release/slide phase — wrapper bottom dropped below
    //       sticky-top + height, so the header is sliding up over the next
    //       sticky slot.
    // Both cases are moments where something is actually moving under/at the
    // pinned header, which is when a depth shadow is meaningful.
    useEffect(() => {
        const scroller = containerRef.current;
        if (!scroller) return;
        let pending = false;
        const compute = () => {
            pending = false;
            const scrollerTop = scroller.getBoundingClientRect().top;
            const pinned: { id: string; wrapper: HTMLElement; sliding: boolean }[] = [];
            scroller.querySelectorAll<HTMLElement>("[data-tree-category]").forEach(row => {
                const wrapper = row.parentElement;
                if (!wrapper) return;
                const wrapperTop = wrapper.getBoundingClientRect().top - scrollerTop;
                const rowTop = row.getBoundingClientRect().top - scrollerTop;
                const stickyTop = parseFloat(row.style.top || "0");
                const isPinned = rowTop > wrapperTop + 0.5;
                if (!isPinned) return;
                const id = row.getAttribute("data-tree-node-id");
                if (!id) return;
                const sliding = rowTop < stickyTop - 0.5;
                pinned.push({ id, wrapper, sliding });
            });
            // Only STATICALLY-pinned descendants block the shadow — they sit
            // motionless directly below their parent. A sliding descendant is
            // itself moving, so the parent above it sees motion and qualifies
            // for shadow (covers the case: Atoms sliding ⇒ shadow on Primitives).
            const staticPinnedIds = new Set(pinned.filter(p => !p.sliding).map(p => p.id));
            const next = new Set<string>();
            for (const { id, wrapper } of pinned) {
                let hasStaticPinnedDescendant = false;
                wrapper.querySelectorAll<HTMLElement>("[data-tree-category]").forEach(descRow => {
                    const descId = descRow.getAttribute("data-tree-node-id");
                    if (descId && descId !== id && staticPinnedIds.has(descId)) {
                        hasStaticPinnedDescendant = true;
                    }
                });
                if (!hasStaticPinnedDescendant) next.add(id);
            }
            setStuckIds(prev => {
                if (prev.size === next.size) {
                    let same = true;
                    for (const id of prev) if (!next.has(id)) { same = false; break; }
                    if (same) return prev;
                }
                return next;
            });
        };
        const onScroll = () => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(compute);
        };
        compute();
        scroller.addEventListener("scroll", onScroll, { passive: true });
        return () => scroller.removeEventListener("scroll", onScroll);
    }, [openIds, data]);

    const expandKey = (expandIds ?? []).join("|");
    // Highlighted set: anything in expandIds is highlighted, plus activeId (kept
    // for callers that drive only "primary active" without tracking visibility).
    // Memoized so memo'd Tree children don't re-render when identity-only-changes.
    const highlightedIds = useMemo(() => {
        const s = new Set<string>(expandIds ?? []);
        if (activeId) s.add(activeId);
        return s;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expandKey, activeId]);
    useEffect(() => {
        const targets = new Set<string>(expandIds ?? []);
        if (activeId) targets.add(activeId);
        if (targets.size === 0) return;
        const next = new Set<string>();
        for (const id of targets) {
            const path = findPath(data, id);
            if (path) for (const p of path) next.add(p);
        }
        setOpenIds(prev => {
            if (prev.size === next.size) {
                let same = true;
                for (const id of prev) if (!next.has(id)) { same = false; break; }
                if (same) return prev;
            }
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId, expandKey, data]);

    useEffect(() => {
        if (!activeId) return;
        const raf = requestAnimationFrame(() => {
            const container = containerRef.current;
            if (!container) return;
            const row = container.querySelector(
                `[data-tree-node-id="${CSS.escape(activeId)}"]`
            ) as HTMLElement | null;
            if (!row) return;
            const rowRect = row.getBoundingClientRect();
            const contRect = container.getBoundingClientRect();
            if (rowRect.top < contRect.top) {
                container.scrollTop += rowRect.top - contRect.top;
            } else if (rowRect.bottom > contRect.bottom) {
                container.scrollTop += rowRect.bottom - contRect.bottom;
            }
        });
        return () => cancelAnimationFrame(raf);
    }, [activeId, openIds]);

    const handleToggle = (id: string) => {
        setOpenIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const Component = ({node, onToggle, isOpen, depth, active, stuck}: {
        node: Node, onToggle: () => void, isOpen: boolean, depth: number, active: boolean, stuck: boolean
    }) => {
        switch(node.tag) {
            case NodeTag.Category:
                return (
                    <GroupRow
                        nodeId={node.id}
                        label={node.label}
                        itemCount={node.children.length}
                        isOpen={isOpen}
                        onToggle={onToggle}
                        onClick={onNodeClick ? () => onNodeClick(node) : undefined}
                        onRightClick={onNodeRightClick ? (e) => onNodeRightClick(node, e) : undefined}
                        depth={depth}
                        active={active}
                        stuck={stuck}
                    />
                );
            case NodeTag.Item:
                return (
                    <ContentRow
                        nodeId={node.id}
                        label={node.label}
                        onClick={onNodeClick ? () => onNodeClick(node) : undefined}
                        onRightClick={onNodeRightClick ? (e) => onNodeRightClick(node, e) : undefined}
                        depth={depth}
                        active={active}
                    />
                );
        }
    };

    return (
        <div className={css(globalStyles.substrate)} style={{display: "flex", flexDirection: "column", minHeight: 0, ...style}}>
            <div className={css(timelineCard.content)}>
                <span className={css(globalStyles.headline, timelineCard.headline)}>
                    {title}
                </span>
                <div
                    ref={containerRef}
                    className={css(timelineCard.scrollArea)}
                >
                    {data.length !== 0 ? data.map((e) => (
                        <Tree
                            key={e.id}
                            node={e}
                            Component={Component}
                            openIds={openIds}
                            onToggle={handleToggle}
                            highlightedIds={highlightedIds}
                            stuckIds={stuckIds}
                        />)
                    ) : (
                        <ContentRow
                            label={"NO DATA"}
                            style={{
                                textAlign: "center",
                                color: palette.darkenedUninteractive,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};