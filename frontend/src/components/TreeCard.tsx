import React, { memo, useState } from 'react';
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
    label: string,
    itemCount: number,
    onToggle: () => void,
    onClick?: () => void,
    isOpen: boolean,
    depth: number,
}

const GroupRow: React.FC<CategoryRowProps> = ({
    label,
    itemCount,
    isOpen,
    onToggle,
    onClick,
    depth,
}) => {
    const Icon = isOpen ? MinusInSquare : PlusInSquare;
    return (
        <div
            className={css(onClick && baseRow.interactive, categoryRow.row)}
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

const ContentRow = ({label, style, onClick, depth = 0}: {label: string, style?: any, onClick?: () => void, depth?: number}) => (
    <div
        className={css(onClick && baseRow.interactive)}
        style={{...rowPadding(depth), ...style}}
        onClick={onClick}
    >
        {label}
    </div>
);

const Tree = memo(({node, Component, depth = 0}: {node: any, Component: any, depth?: number}) => {
    const [isOpen, setOpen] = useState(false);
    return (
        <>
            <Component
                onToggle={() => setOpen(!isOpen)}
                node={node}
                isOpen={isOpen}
                depth={depth}
            />
            {node.children && isOpen && node.children.map((n: any, i: number) =>
                <Tree key={i} node={n} Component={Component} depth={depth + 1}/>
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
    label: string,
    children: Node[],
}

export interface Item {
    tag: NodeTag.Item,
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

export const TreeCard = ({data, title, style={}, onNodeClick}: {data: Node[], title: string, style?: any, onNodeClick?: (node: Node) => void}) => {
    const Component = ({node, onToggle, isOpen, depth}: {node: Node, onToggle: () => void, isOpen: boolean, depth: number}) => {
        switch(node.tag) {
            case NodeTag.Category:
                return (
                    <GroupRow
                        label={node.label}
                        itemCount={node.children.length}
                        isOpen={isOpen}
                        onToggle={onToggle}
                        onClick={onNodeClick ? () => onNodeClick(node) : undefined}
                        depth={depth}
                    />
                );
            case NodeTag.Item:
                return (
                    <ContentRow
                        label={node.label}
                        onClick={onNodeClick ? () => onNodeClick(node) : undefined}
                        depth={depth}
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
                    {data.length !== 0 ? data.map((e: any) => (
                        <Tree 
                            node={e} 
                            Component={Component}
                        />)
                    ) : 
                    (
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
