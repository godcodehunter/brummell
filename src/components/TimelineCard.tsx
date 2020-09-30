import React, { useState, useEffect } from 'react';
import { StyleSheet, css } from 'aphrodite';
import { PlusInSquare, MinusInSquare } from '../icons';

interface CategoryRowProps {
    label: string,
    itemCount: number,
    onExpand: () => void,
    isExpanded: boolean,
    onCollapse: () => void,
    style?: any,
}

const CategoryRow: React.FC<CategoryRowProps> = ({
    label, 
    itemCount, 
    onExpand, 
    isExpanded, 
    onCollapse, 
    style,
}) => {
    const Icon = isExpanded ? MinusInSquare : PlusInSquare;
    return (
        <div style={{display: "flex", direction: "row", gap: 6, ...style}}>
            <Icon 
                style={{width: 14, height: 14, cursor: "pointer",}} 
                fill="#ABABAB" 
                onClick={()=>{
                    isExpanded ? onCollapse() : onExpand();
                }}
            />
            <span style={{flexGrow: 1}}>
                {label}
            </span>
            <span 
                style={{
                    color: "#858585", 
                    fontSize: 12,
                }}
            >
                {`[ ${itemCount} ]`}
            </span>
            
        </div>
    );
};

const PostRow = ({label, style}: {label: string, style?: any}) => {
    return (
        <div style={style}>{label}</div>
    );
};

const Tree = ({data, projection}: {data: [any], projection: (node: Node, props: any) => JSX.Element}) => {
    const [expanded, setExpanded] = useState<any[]>([]);

    function *dfs(nodes: [any], filter: (a: any) => boolean) {
        function upLg(lnque: any, num: any) {
            console.log(["test", lnque, num]);
            lnque.a[lnque.a.length-1]--;
            if(lnque[lnque.a.length-1] == 0) {
                lnque.a.pop();
                num.n--;
            }
        }

        let queue = [...nodes];

        let current;
        let level = {n: 0};
        let lnque: {a: number[]} = {a: []};
        lnque.a.push(queue.length); 
        console.log("test", queue.length);

        while(queue.length != 0) {
            current = queue.shift();
            upLg(lnque, level);

            if(filter(current)) {
                level.n++;
                let children = [...current.children];
                children.map((e: any) => e.level=level.n)
                queue.unshift(...children);
            }
            
            yield current;
        }
    };
    const [com, setCom] = useState<any[]>([]);

    useEffect(() => {
        let arr = [];
        for(let node of dfs(data, (el) => expanded.includes(el))) {
            arr.push(node);
        }
        setCom(arr);
    }, [expanded, data]);
    
 
    return (
        <>
            {com.map((el) => (
                <>
                {projection(el, {
                    onExpand: () => { setExpanded([...expanded, el]); }, 
                    onCollapse: () => { setExpanded(ex => ex.filter(n => n !== el)); },
                    isExpanded: expanded.includes(el),
                })}
                </>
            ))}
        </>
    );
}

const styles = StyleSheet.create({
    substrate: {
        backgroundColor: "#2E2E2E",
        boxShadow: "8px 8px 0px rgba(0, 0, 0, 0.25)",
    },
    headline: {
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: "bold",
        fontSize: "12px",
        lineHeight: "26px",
        color: "#D4D4D4",
        alignItems: "center",
    },
    content: {
        display: "flex",
        flexDirection: "column",
    },
});

type Node = Category | Item;
enum NodeTag {
    Category,
    Item,
}

interface Category {
    tag: NodeTag.Category,
    label: string,
    children: [Node],
}

interface Item {
    tag: NodeTag.Item,
    label: string,
}

export const TimelineCard = ({style}: {style: any}) => {
    const data: any = [
        {tag: NodeTag.Category, label: "el-1", children: [
            {tag: NodeTag.Item, label: "el-1-1"},
            {tag: NodeTag.Item, label: "el-1-2"},
            {tag: NodeTag.Item, label: "el-1-3"},
            {tag: NodeTag.Item, label: "el-1-4"},
            {tag: NodeTag.Item, label: "el-1-5"},
            {tag: NodeTag.Item, label: "el-1-6"},
        ]},
        {tag: NodeTag.Category, label: "el-2", children: [
            {tag: NodeTag.Item, label: "el-2-1"},
            {tag: NodeTag.Item, label: "el-2-2"},
            {tag: NodeTag.Item, label: "el-2-3"},
            {tag: NodeTag.Item, label: "el-2-4"},
            {tag: NodeTag.Item, label: "el-2-5"},
            {tag: NodeTag.Item, label: "el-2-6"},
            {tag: NodeTag.Item, label: "el-2-7"},
            {tag: NodeTag.Item, label: "el-2-8"},
            {tag: NodeTag.Item, label: "el-2-9"},
            {tag: NodeTag.Item, label: "el-2-10"},
            {tag: NodeTag.Item, label: "el-2-11"},
            {tag: NodeTag.Item, label: "el-2-12"},
        ]},
        {tag: NodeTag.Category, label:"el-3", children: [
            {tag: NodeTag.Item, label: "el-3-1"},
            {tag: NodeTag.Item, label: "el-3-2"},
            {tag: NodeTag.Item, label: "el-3-3"},
            {tag: NodeTag.Item, label: "el-3-4"},
            {tag: NodeTag.Item, label: "el-3-5"},
            {tag: NodeTag.Item, label: "el-3-6"},
            {tag: NodeTag.Item, label: "el-3-7"},
            {tag: NodeTag.Item, label: "el-3-8"},
            {tag: NodeTag.Item, label: "el-3-9"},
            {tag: NodeTag.Item, label: "el-3-10"},
            {tag: NodeTag.Item, label: "el-3-11"},
            {tag: NodeTag.Item, label: "el-3-12"},
        ]},
    ];

    const Shift = ({step=0, children}: {step?: number, children: JSX.Element}) => (
        <div style={{paddingLeft: 12*step, height: 20}}>
            {children}
        </div>
    );
    
    const projection = (node: Node, props: any) => {
        switch(node.tag) {
            case NodeTag.Category: 
                return (
                    <CategoryRow 
                        label={node.label} 
                        itemCount={node.children.length}
                        {...props}
                    />
                );
            case NodeTag.Item:
                return (
                    // @ts-ignore
                    <Shift step={node.level}>
                        <PostRow 
                            label={node.label} 
                        />
                    </Shift>
                );
        }
    };

    return (
        <div className={css(styles.substrate)} style={{...style}}>
            <div className={css(styles.content)}>
                <span className={css(styles.headline)} style={{marginLeft: 8}}>
                    TIMELINE
                </span>
                <div 
                className={"tree"}
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
                   <Tree 
                        data={data} 
                        projection={projection}
                    />
                </div>
            </div>
        </div>
    );
};
