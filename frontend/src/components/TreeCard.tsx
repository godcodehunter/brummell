import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, css } from 'aphrodite';
import { PlusInSquare, MinusInSquare } from '../resource/icons';
import { globalStyles, palette } from '../global_styles';

const INDENT_STEP = 12;
const BASE_PADDING_X = 12;

const rowPadding = (depth: number) => ({
    paddingLeft: BASE_PADDING_X + depth * INDENT_STEP,
    paddingRight: BASE_PADDING_X,
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
        boxShadow: "inset 3px 0 0 #4A9EFF",
    },
});

const categoryRow = StyleSheet.create({
    row: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
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
    isOpen: boolean,
    active: boolean,
    depth: number,
}

const GroupRow: React.FC<CategoryRowProps> = ({
    nodeId,
    label,
    itemCount,
    isOpen,
    onToggle,
    onClick,
    active,
    depth,
}) => {
    const Icon = isOpen ? MinusInSquare : PlusInSquare;
    return (
        <div
            data-tree-node-id={nodeId}
            className={css(onClick && baseRow.interactive, active && baseRow.active, categoryRow.row)}
            style={rowPadding(depth)}
            onClick={onClick}
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
    active?: boolean,
    depth?: number,
}

const ContentRow: React.FC<ContentRowProps> = ({nodeId, label, style, onClick, active, depth = 0}) => (
    <div
        data-tree-node-id={nodeId}
        className={css(onClick && baseRow.interactive, active && baseRow.active)}
        style={{...rowPadding(depth), ...style}}
        onClick={onClick}
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
}

const Tree = memo(({node, Component, depth = 0, openIds, onToggle, highlightedIds}: TreeProps) => {
    const isOpen = openIds.has(node.id);
    return (
        <>
            <Component
                node={node}
                isOpen={isOpen}
                depth={depth}
                active={highlightedIds.has(node.id)}
                onToggle={() => onToggle(node.id)}
            />
            {node.tag === NodeTag.Category && isOpen && node.children.map((n) =>
                <Tree
                    key={n.id}
                    node={n}
                    Component={Component}
                    depth={depth + 1}
                    openIds={openIds}
                    onToggle={onToggle}
                    highlightedIds={highlightedIds}
                />
            )}
        </>
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
    },
    headline: {
        marginLeft: 8,
    }
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
    activeId?: string,
    // Ids whose ancestor path should be force-expanded. Anything not on the
    // expansion union (∪ of paths to each id, plus activeId's path) is closed.
    expandIds?: string[],
}

export const TreeCard: React.FC<TreeCardProps> = ({data, title, style = {}, onNodeClick, activeId, expandIds}) => {
    const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
    const containerRef = useRef<HTMLDivElement>(null);

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

    const Component = ({node, onToggle, isOpen, depth, active}: {
        node: Node, onToggle: () => void, isOpen: boolean, depth: number, active: boolean
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
                        depth={depth}
                        active={active}
                    />
                );
            case NodeTag.Item:
                return (
                    <ContentRow
                        nodeId={node.id}
                        label={node.label}
                        onClick={onNodeClick ? () => onNodeClick(node) : undefined}
                        depth={depth}
                        active={active}
                    />
                );
        }
    };

    return (
        <div className={css(globalStyles.substrate)} style={{...style}}>
            <div className={css(timelineCard.content)}>
                <span className={css(globalStyles.headline, timelineCard.headline)}>
                    {title}
                </span>
                <div
                    ref={containerRef}
                    style={{
                        // substrate
                        backgroundColor: "#1E1E1F",
                        flexGrow: 1,
                        paddingTop: 8,
                        paddingBottom: 8,
                        // container
                        display: "flex",
                        flexDirection: "column",
                        // scrollable
                        maxHeight: 500,
                        overflowX: "auto",
                    }}>
                    {data.length !== 0 ? data.map((e) => (
                        <Tree
                            key={e.id}
                            node={e}
                            Component={Component}
                            openIds={openIds}
                            onToggle={handleToggle}
                            highlightedIds={highlightedIds}
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