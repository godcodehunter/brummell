import Editor from "@monaco-editor/react";
import { StyleSheet, css } from "aphrodite";
import { TreeCard, NodeTag, Category, Node } from '../../components/TreeCard';
import { ContextMenu, ContextMenuItem } from '../../components/ContextMenu';
import { SplitPane, Panel } from '../../components/SplitPane';
import { useEffect, useMemo, useRef, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";

interface ExternalLink {
    svg_icon: string;
    url: string;
}

interface Owner {
    nickname: string;
    about_myself: string;
    avatar: string;
    external_links: ExternalLink[];
}

const GET_OWNER = gql`
    query GetOwner {
        getOwner {
            nickname
            aboutMyself
            avatar
            externalLinks {
                svgIcon
                url
            }
        }
    }
`;

const UPDATE_OWNER = gql`
    mutation UpdateOwner(
        $nickname: String!
        $aboutMyself: String!
        $avatar: String!
        $externalLinks: [ExternalLinkInput!]!
    ) {
        updateOwner(
            nickname: $nickname
            aboutMyself: $aboutMyself
            avatar: $avatar
            externalLinks: $externalLinks
        ) {
            nickname
            aboutMyself
            avatar
            externalLinks {
                svgIcon
                url
            }
        }
    }
`;

const GET_TAGS = gql`
    query GetTags {
        getTag {
            id
            label
            color
            tooltip
        }
    }
`;

const GET_EDITABLE_ITEMS = gql`
    query GetEditableItems {
        getEditableItems {
            id
            path
            contentType
            publishStatus
        }
    }
`;

const styles = StyleSheet.create({
    root: {
        display: "flex",
        flexDirection: "row",
        height: "100vh",
    },
});


interface ContentItem {
    id: string,
    // Path relative to the content root
    path: string;
    // Item without type is considered a folder.
    contentType?: "shot" | "article" | "podcast" | "library" | "media" | "dir";
    // Only `shot`, `article` and `podcast` can be published or draft.
    publishStatus?: "published" | "draft";
}

function reconstructTree(items: ContentItem[]): Category<ContentItem>[] {
    const root: Category<ContentItem>[] = [];

    const findCategoryAt = (
        siblings: Node<ContentItem>[],
        path: string,
    ): Category<ContentItem> | undefined =>
        siblings.find(
            (n): n is Category<ContentItem> =>
                n.tag === NodeTag.Category && (n as Category<ContentItem>).path === path,
        );

    const ensureCategoryAt = (
        siblings: Node<ContentItem>[],
        path: string,
        name: string,
        id: string,
    ): Category<ContentItem> => {
        const existing = findCategoryAt(siblings, path);
        if (existing) return existing;
        const created = {
            tag: NodeTag.Category,
            id,
            label: `📁 ${name}`,
            children: [],
            path,
            contentType: "dir",
        } as Category<ContentItem>;
        siblings.push(created);
        return created;
    };

    for (const item of items) {
        const parts = item.path.split("/");
        let siblings = root as Node<ContentItem>[];

        let currentPath = "";
        for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            const cat = ensureCategoryAt(siblings, currentPath, parts[i], currentPath);
            siblings = cat.children;
        }

        const name = parts[parts.length - 1];

        if (item.contentType === "dir") {
            // A dir whose path was already auto-materialized while restoring a
            // descendant — nothing to add, just move on.
            if (findCategoryAt(siblings, item.path)) continue;
            ensureCategoryAt(siblings, item.path, name, item.id);
        } else {
            siblings.push(constructNodeFromItem(item));
        }
    }

    return root;
}

/// Some node such as article and podcast have pseudo files under them (e.g. `def.json` for article). We want to show them in the tree, but they don't exist in the database. This function adds those pseudo nodes to the tree.
function constructNodeFromItem(item: ContentItem): Node<ContentItem> {
    let icon;
    switch (item.contentType) {
        case "shot": icon = "🎬"; break;
        case "article": icon = "📄"; break;
        case "podcast": icon = "🎙️"; break;
        case "library": icon = "⚙️"; break;
        case "media": icon = "🖼️"; break;
        default: icon = "❓"; break;
    }

    let status = item.publishStatus === "published" ? "✅" : "🔨";

    const parts = item.path.split("/");
    const name = parts[parts.length - 1];

    if (item.contentType === "article") {
        return {
            ...item,
            tag: NodeTag.Category,
            id: item.id.toString(),
            label: `${icon} ${name} ${status}`,
            children: [
                {
                    id: `${item.id}/def`,
                    tag: NodeTag.Item,
                    label: "def.json",
                    path: `${item.path}/def.json`,
                },
                {
                    id: `${item.id}/main`,
                    tag: NodeTag.Item,
                    label: "main.mdx",
                    path: `${item.path}/main.mdx`,
                }
            ],
        };
    }

    if (item.contentType === "podcast") {
        return {
            ...item,
            tag: NodeTag.Category,
            id: item.id.toString(),
            label: `${icon} ${name} ${status}`,
            children: [
                {
                    id: `${item.id}/def`,
                    tag: NodeTag.Item,
                    label: "def.json",
                    path: `${item.path}/def.json`,
                },
                {
                    id: `${item.id}/main`,
                    tag: NodeTag.Item,
                    label: "main.sound",
                    path: `${item.path}/main.sound`,
                }
            ],
        };
    }

    return {
        ...item,
        tag: NodeTag.Item,
        id: item.id.toString(),
        label: `${icon} ${name} ${status}`,
    };
}

const profileEditTip = `// The profle data have the following structure:
// {
//    nickname: string;
//    aboutMyself: string;
//    avatar: string;
//    externalLinks: {
//         svgIcon: string;
//         url: string;
//    }[];
// }`;

type EditingMode = "profile" | "tags" | null;

const SIDEBAR_ITEMS: Node[] = [
    { id: "profile", tag: NodeTag.Item, label: "Profile 🪪" },
    { id: "tags",    tag: NodeTag.Item, label: "Tags 🏷️"   },
];

export const ArticleCreator = () => {
    const { data, loading, error } = useQuery(GET_EDITABLE_ITEMS, {
        fetchPolicy: "network-only",
    });

    const treeData = useMemo<Node[]>(() => [
        ...SIDEBAR_ITEMS,
        {
            id: "content",
            tag: NodeTag.Category,
            label: "Content",
            children: reconstructTree(data?.getEditableItems ?? []),
        } as Node,
    ], [data]);

    const [editorValue, setEditorValue] = useState("");
    const [menu, setMenu] = useState<{ x: number; y: number; node: Node } | null>(null);
    const editingModeRef = useRef<EditingMode>(null);

    const removeInternal = (key: string, value: any) => key.startsWith("__") ? undefined : value;

    const [fetchOwner] = useLazyQuery<{ getOwner: Owner | null }>(GET_OWNER, {
        fetchPolicy: "network-only",
        onCompleted: data => {
            editingModeRef.current = "profile";
            setEditorValue(profileEditTip + "\n\n" + JSON.stringify(data?.getOwner ?? null, removeInternal, 4));
        },
        onError: err => {
            editingModeRef.current = null;
            setEditorValue(`// error: ${err.message}`);
        },
    });

    const [fetchTags] = useLazyQuery(GET_TAGS, {
        fetchPolicy: "network-only",
        onCompleted: data => {
            editingModeRef.current = "tags";
            setEditorValue(JSON.stringify(data.getTag, removeInternal, 4));
        },
        onError: err => {
            editingModeRef.current = null;
            setEditorValue(`// error: ${err.message}`);
        },
    });

    const [updateOwner] = useMutation(UPDATE_OWNER);

    const stripComments = (src: string) =>
        src.split("\n").filter(line => !line.trim().startsWith("//")).join("\n").trim();

    const saveProfile = async () => {
        const jsonText = stripComments(editorValue);
        if (!jsonText) return;
        let parsed: any;
        try {
            parsed = JSON.parse(jsonText);
        } catch (e) {
            setEditorValue(editorValue + `\n// parse error: ${(e as Error).message}`);
            return;
        }
        try {
            await updateOwner({
                variables: {
                    nickname: parsed.nickname ?? "",
                    aboutMyself: parsed.aboutMyself ?? "",
                    avatar: parsed.avatar ?? "",
                    externalLinks: (parsed.externalLinks ?? []).map(
                        (l: any) => ({ svgIcon: l.svgIcon ?? "", url: l.url ?? "" }),
                    ),
                },
            });
        } catch (e) {
            setEditorValue(editorValue + `\n// save error: ${(e as Error).message}`);
        }
    };

    const saveProfileRef = useRef(saveProfile);
    saveProfileRef.current = saveProfile;

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
            if (!isSave) return;
            if (editingModeRef.current !== "profile") return;
            e.preventDefault();
            e.stopPropagation();
            saveProfileRef.current();
        };
        window.addEventListener("keydown", onKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
    }, []);


    function onTreeItemClick(node: Node) {
        if (node.id === "profile") {
            fetchOwner();
        }
        if (node.id === "tags") {
            fetchTags();
        }
    }

    const menuItems = (node: Node): ContextMenuItem[] => {
        // Profile and tags are special nodes that don't represent actual content items, so we don't show any context menu for them.
        if (node.id === "profile" || node.id === "tags") {
            return [];
        }

        let result = node.tag === NodeTag.Category
            ? [
                { label: "New Shot", onClick: () => console.log("New Shot in", node.id) },
                { label: "New Article", onClick: () => console.log("New Article in", node.id) },
                { label: "New Podcast", onClick: () => console.log("New Podcast in", node.id) },
                { label: "New Folder", onClick: () => console.log("New Folder in", node.id) },
            ]
            : [
                { label: "Rename", onClick: () => console.log("Rename", node.id) },
                { label: "Delete", danger: true, onClick: () => console.log("Delete", node.id) },
            ];

        if (node.tag === NodeTag.Category && node.id != "content") {
            result.push(
                { label: "Rename", onClick: () => console.log("Rename", node.id) }
            )
            result.push(
                { label: "Delete", danger: true, onClick: () => console.log("Delete", node.id) }
            )
        }

        return result;
    }

    return <div className={css(styles.root)}>
        <SplitPane storageKey="editor-layout">
            <Panel defaultSize={260} minSize={150} maxSize={600}>
                <TreeCard
                    title="Files"
                    data={treeData}
                    onNodeClick={onTreeItemClick}
                    onNodeRightClick={(node, e) => setMenu({ x: e.clientX, y: e.clientY, node })}
                    style={{ height: "100%" }}
                />
            </Panel>
            <Panel flex>
                <Editor
                    value={editorValue}
                    onChange={v => setEditorValue(v ?? "")}
                    height="100%"
                    defaultLanguage="js"
                    theme="vs-dark"
                    options={{
                        wordWrap: "on",
                        minimap: { enabled: false },
                    }}
                />
            </Panel>
        </SplitPane>
        {menu && (
            <ContextMenu
                x={menu.x}
                y={menu.y}
                items={menuItems(menu.node)}
                onClose={() => setMenu(null)}
            />
        )}
    </div>
};
