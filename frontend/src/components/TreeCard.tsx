import React, { memo, useState } from 'react';
import { StyleSheet, css } from 'aphrodite';
import { PlusInSquare, MinusInSquare } from '../resource/icons';
import { globalStyles, palette } from '../global_styles';

const baseRow = StyleSheet.create({
    row: {
        // height: 18,
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
    onClick: () => void,
    isOpen: boolean,
}

const GroupRow: React.FC<CategoryRowProps> = ({
    label, 
    itemCount, 
    isOpen, 
    onClick,
}) => {
    const Icon = isOpen ? MinusInSquare : PlusInSquare;    
    return (
        <div className={css(baseRow.row, categoryRow.row)}>
            <Icon 
                className={css(categoryRow.toggleIcon)}
                //TODO: try move to style
                fill="#ABABAB" 
                onClick={onClick}
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

const ContentRow = ({label, style}: {label: string, style?: any}) => (
    <div className={css(baseRow.row)} style={style}>{label}</div>
);

const Tree = memo(({node, Component}: {node: any, Component: any}) => {
    const [isOpen, setOpen] = useState(false);
    return (
        <>
            <Component 
                onClick={()=>setOpen(!isOpen)} 
                node={node} 
                isOpen={isOpen}
            />
            {node.children && isOpen && <div style={{paddingLeft: 12}}>
                {node.children.map((n: any, i: number) => 
                    <Tree key={i} node={n} Component={Component}/>
                )}
            </div>}
        </>
    );
});

type Node = Category | Item;
export enum NodeTag {
    Category,
    Item,
}

export interface Category {
    tag: NodeTag.Category,
    label: string,
    children: Node[],
}

interface Item {
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

export const TreeCard = ({data, title, style={}}: {data: Node[], title: string, style?: any}) => {
    const Component = ({node, onClick, isOpen}: {node: Node, onClick: any, isOpen: any}) => {
        switch(node.tag) {
            case NodeTag.Category: 
                return (
                    <GroupRow 
                        label={node.label} 
                        itemCount={node.children.length}
                        isOpen={isOpen}
                        onClick={onClick}
                    />
                );
            case NodeTag.Item:
                return (
                    <ContentRow label={node.label}/>
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
                    padding: 8,
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
