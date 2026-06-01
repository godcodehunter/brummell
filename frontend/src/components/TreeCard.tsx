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
    dropTarget: {
        outline: "1px dashed #6CA9E8",
        outlineOffset: -1,
        backgroundColor: "rgba(108, 169, 232, 0.12)",
    },
});

type RowDragHandlers = {
    onDragOver: (e: React.DragEvent) => void,
    onDragLeave: (e: React.DragEvent) => void,
    onDrop: (e: React.DragEvent) => void,
    onDragStart?: (e: React.DragEvent) => void,
    draggable?: boolean,
};

// Custom mime used to mark drags that originate from inside the tree, so
// the drop handlers can tell node-moves apart from file uploads.
const NODE_MIME = "application/x-brummell-tree-node";

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
        display: "flex",
        alignItems: "center",
        flex: "1 1 0%",
        minWidth: 0,
        overflow: "hidden",
    },
    defaultLabelText: {
        flex: "1 1 0%",
        minWidth: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
    },
    toggleIcon: {
        width: 14,
        height: 14,
        cursor: "pointer",
        flexShrink: 0,
    },
    itemsCount: {
        color: "#858585",
        fontSize: 12,
        flexShrink: 0,
        whiteSpace: "nowrap",
    }
});

interface CategoryRowProps {
    nodeId: string,
    view: React.ReactNode,
    itemCount: number,
    onToggle: () => void,
    onClick?: () => void,
    onRightClick?: (e: React.MouseEvent) => void,
    isOpen: boolean,
    active: boolean,
    stuck: boolean,
    depth: number,
    dragOver?: boolean,
    dragHandlers?: RowDragHandlers,
}

const GroupRow: React.FC<CategoryRowProps> = ({
    nodeId,
    view,
    itemCount,
    isOpen,
    onToggle,
    onClick,
    onRightClick,
    active,
    stuck,
    depth,
    dragOver,
    dragHandlers,
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
            className={css(categoryRow.row, isSticky && categoryRow.sticky, stuck && categoryRow.stuck, onClick && baseRow.interactive, active && baseRow.active, dragOver && baseRow.dropTarget)}
            style={isSticky ? {...rowPadding(depth), top: depth * ROW_HEIGHT, zIndex: 100 - depth} : rowPadding(depth)}
            onClick={onClick}
            onContextMenu={onRightClick && ((e) => { e.preventDefault(); onRightClick(e); })}
            {...(dragHandlers ?? {})}
        >
            <Icon
                className={css(categoryRow.toggleIcon)}
                //TODO: try move to style
                fill="#ABABAB"
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
            />
            <span className={css(categoryRow.label)}>
                {view}
            </span>
            <span className={css(categoryRow.itemsCount)}>
                {`[ ${itemCount} ]`}
            </span>
        </div>
    );
};

interface ContentRowProps {
    nodeId?: string,
    view: React.ReactNode,
    style?: any,
    onClick?: () => void,
    onRightClick?: (e: React.MouseEvent) => void,
    active?: boolean,
    depth?: number,
    dragOver?: boolean,
    dragHandlers?: RowDragHandlers,
}

const ContentRow: React.FC<ContentRowProps> = ({nodeId, view, style, onClick, onRightClick, active, depth = 0, dragOver, dragHandlers}) => (
    <div
        data-tree-node-id={nodeId}
        className={css(onClick && baseRow.interactive, active && baseRow.active, dragOver && baseRow.dropTarget)}
        style={{...rowPadding(depth), display: "flex", alignItems: "center", minWidth: 0, overflow: "hidden", ...style}}
        onClick={onClick}
        onContextMenu={onRightClick && ((e) => { e.preventDefault(); onRightClick(e); })}
        {...(dragHandlers ?? {})}
    >
        {view}
    </div>
);

interface TreeProps {
    node: Node,
    depth?: number,
    openIds: Set<string>,
    onToggle: (id: string) => void,
    highlightedIds: Set<string>,
    stuckIds: Set<string>,
    viewItem?: (node: Node) => React.ReactNode,
    onNodeClick?: (node: Node) => void,
    onNodeRightClick?: (node: Node, e: React.MouseEvent) => void,
    onNodeDropFiles?: (node: Node, files: FileList) => void,
    onNodeMove?: (sourceId: string, target: Node) => void,
    isNodeDraggable?: (node: Node) => boolean,
    isNodeDropTarget?: (node: Node) => boolean,
}

// Render GroupRow/ContentRow directly here rather than going through a
// caller-supplied `Component` prop — that older pattern caused React to
// unmount/remount the whole node subtree whenever Component identity changed,
// which destroyed DOM state (including focus) for any inputs the caller
// rendered via `viewItem`.
const Tree = memo(({node, depth = 0, openIds, onToggle, highlightedIds, stuckIds, viewItem, onNodeClick, onNodeRightClick, onNodeDropFiles, onNodeMove, isNodeDraggable, isNodeDropTarget}: TreeProps) => {
    const isOpen = openIds.has(node.id);
    const view = viewItem
        ? viewItem(node)
        : <span className={css(categoryRow.defaultLabelText)}>{node.label}</span>;
    const active = highlightedIds.has(node.id);
    const onClick = onNodeClick ? () => onNodeClick(node) : undefined;
    const onRightClick = onNodeRightClick ? (e: React.MouseEvent) => onNodeRightClick(node, e) : undefined;

    const [dragOver, setDragOver] = useState(false);

    const acceptsFiles = !!onNodeDropFiles;
    const acceptsNodes = !!onNodeMove && (!isNodeDropTarget || isNodeDropTarget(node));
    const canDrag = !!onNodeMove && (!isNodeDraggable || isNodeDraggable(node));

    // Two DnD lanes share this row: HTML5 file uploads (mime "Files") and
    // internal node moves (mime NODE_MIME). dragover highlights for either,
    // drop branches on the mime found in dataTransfer.types.
    const dragHandlers: RowDragHandlers | undefined = (acceptsFiles || acceptsNodes || canDrag) ? {
        draggable: canDrag,
        onDragStart: canDrag ? e => {
            e.dataTransfer.setData(NODE_MIME, node.id);
            e.dataTransfer.effectAllowed = "move";
        } : undefined,
        onDragOver: e => {
            const types = Array.from(e.dataTransfer.types);
            const hasFiles = acceptsFiles && types.includes("Files");
            const hasNode = acceptsNodes && types.includes(NODE_MIME);
            if (!hasFiles && !hasNode) return;
            e.preventDefault();
            if (!dragOver) setDragOver(true);
        },
        onDragLeave: e => {
            const next = e.relatedTarget as globalThis.Node | null;
            if (next && (e.currentTarget as HTMLElement).contains(next)) return;
            setDragOver(false);
        },
        onDrop: e => {
            const types = Array.from(e.dataTransfer.types);
            if (acceptsFiles && types.includes("Files")) {
                e.preventDefault();
                setDragOver(false);
                const files = e.dataTransfer.files;
                if (files && files.length > 0) onNodeDropFiles!(node, files);
                return;
            }
            if (acceptsNodes && types.includes(NODE_MIME)) {
                e.preventDefault();
                setDragOver(false);
                const sourceId = e.dataTransfer.getData(NODE_MIME);
                // Reject self-drops and drops into own descendant prefix —
                // moving X into X/foo would also blow away the subtree.
                if (!sourceId || sourceId === node.id) return;
                if (node.id === sourceId || node.id.startsWith(sourceId + "/")) return;
                onNodeMove!(sourceId, node);
            }
        },
    } : undefined;

    const renderedNode = node.tag === NodeTag.Category ? (
        <GroupRow
            nodeId={node.id}
            view={view}
            itemCount={node.children.length}
            isOpen={isOpen}
            onToggle={() => onToggle(node.id)}
            onClick={onClick}
            onRightClick={onRightClick}
            depth={depth}
            active={active}
            stuck={stuckIds.has(node.id)}
            dragOver={dragOver}
            dragHandlers={dragHandlers}
        />
    ) : (
        <ContentRow
            nodeId={node.id}
            view={view}
            onClick={onClick}
            onRightClick={onRightClick}
            depth={depth}
            active={active}
            dragOver={dragOver}
            dragHandlers={dragHandlers}
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
                    depth={depth + 1}
                    openIds={openIds}
                    onToggle={onToggle}
                    highlightedIds={highlightedIds}
                    stuckIds={stuckIds}
                    viewItem={viewItem}
                    onNodeClick={onNodeClick}
                    onNodeRightClick={onNodeRightClick}
                    onNodeDropFiles={onNodeDropFiles}
                    onNodeMove={onNodeMove}
                    isNodeDraggable={isNodeDraggable}
                    isNodeDropTarget={isNodeDropTarget}
                />
            )}
        </div>
    );
});

export enum NodeTag {
    Category,
    Item,
}

export type Category<E = {}> = {
    tag: NodeTag.Category,
    id: string,
    label: string,
    children: Node<E>[],
} & E;

export type Item<E = {}> = {
    tag: NodeTag.Item,
    id: string,
    label: string,
} & E;

export type Node<E = {}> = Category<E> | Item<E>;

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

// Imperative escape hatch — used by callers that mutate node ids (e.g.
// rename) and need to migrate the internally-tracked "open" set so the
// renamed subtree stays expanded across the data refetch.
export type TreeCardController = {
    rewriteOpenIds: (remap: (id: string) => string) => void,
    // Additively open the ancestor path of `id` *including `id` itself* —
    // leaves other open folders alone. Use when you want a node visible
    // AND expanded (e.g. a parent under which a placeholder child must
    // appear).
    openPath: (id: string) => void,
    // Same, but stops at the parent — opens every ancestor without
    // expanding `id`. Use when you only need `id` *visible*, not opened
    // (e.g. surfacing a folder being renamed without unfolding it).
    openAncestors: (id: string) => void,
};

interface TreeCardProps<E = {}> {
    data: Node<E>[],
    title: string,
    style?: any,
    onNodeClick?: (node: Node<E>) => void,
    onNodeRightClick?: (node: Node<E>, e: React.MouseEvent) => void,
    activeId?: string,
    // Ids whose ancestor path should be force-expanded. Anything not on the
    // expansion union (∪ of paths to each id, plus activeId's path) is closed.
    expandIds?: string[],
    // Pluggable view for each node — applies to both categories and items. The
    // returned ReactNode replaces the label slot (next to the toggle icon for
    // categories; the row body for items). Defaults to `node.label`.
    viewItem?: (node: Node<E>) => React.ReactNode,
    // Receives a controller object exposing imperative operations (see
    // `TreeCardController`). Optional; pass when you need to remap openIds
    // from outside (e.g. after a rename invalidates the existing ids).
    controllerRef?: React.MutableRefObject<TreeCardController | null>,
    // Fires when the user drops native files onto a row (HTML5 file DnD).
    // Each row in the tree becomes a drop target when this is set; the
    // caller decides where the files actually land based on `node`.
    onNodeDropFiles?: (node: Node<E>, files: FileList) => void,
    // Internal node move: user drags one row onto another. Caller decides
    // what "move" means (typically: rename source path to live under
    // target). `sourceId` is the dragged row's tree id; lookup is owner's
    // responsibility.
    onNodeMove?: (sourceId: string, target: Node<E>) => void,
    isNodeDraggable?: (node: Node<E>) => boolean,
    isNodeDropTarget?: (node: Node<E>) => boolean,
}

export function TreeCard<E = {}>({data, title, style = {}, onNodeClick, onNodeRightClick, activeId, expandIds, viewItem, controllerRef, onNodeDropFiles, onNodeMove, isNodeDraggable, isNodeDropTarget}: TreeCardProps<E>) {
    const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

    // findPath uses the latest data via this ref — the controller closure
    // is bound once (controllerRef dep only) and otherwise wouldn't see
    // new rows added after it was installed.
    const dataRef = useRef<Node<E>[]>(data);
    dataRef.current = data;
    useEffect(() => {
        if (!controllerRef) return;
        controllerRef.current = {
            rewriteOpenIds(remap) {
                setOpenIds(prev => {
                    const next = new Set<string>();
                    for (const id of prev) next.add(remap(id));
                    return next;
                });
            },
            openPath(id) {
                setOpenIds(prev => {
                    const path = findPath(dataRef.current as Node[], id);
                    if (!path) return prev;
                    const next = new Set(prev);
                    for (const p of path) next.add(p);
                    return next;
                });
            },
            openAncestors(id) {
                setOpenIds(prev => {
                    const path = findPath(dataRef.current as Node[], id);
                    if (!path) return prev;
                    const next = new Set(prev);
                    // Drop the final segment — that's `id` itself.
                    for (let i = 0; i < path.length - 1; i++) next.add(path[i]);
                    return next;
                });
            },
        };
        return () => { controllerRef.current = null; };
    }, [controllerRef]);

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
                            node={e as Node}
                            openIds={openIds}
                            onToggle={handleToggle}
                            highlightedIds={highlightedIds}
                            stuckIds={stuckIds}
                            viewItem={viewItem as ((node: Node) => React.ReactNode) | undefined}
                            onNodeClick={onNodeClick as ((node: Node) => void) | undefined}
                            onNodeRightClick={onNodeRightClick as ((node: Node, e: React.MouseEvent) => void) | undefined}
                            onNodeDropFiles={onNodeDropFiles as ((node: Node, files: FileList) => void) | undefined}
                            onNodeMove={onNodeMove as ((sourceId: string, target: Node) => void) | undefined}
                            isNodeDraggable={isNodeDraggable as ((node: Node) => boolean) | undefined}
                            isNodeDropTarget={isNodeDropTarget as ((node: Node) => boolean) | undefined}
                        />)
                    ) : (
                        <ContentRow
                            view={"NO DATA"}
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
}