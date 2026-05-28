import { NodeTag, Category, Node } from '../../components/TreeCard'
import { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { ContentItem } from './Editor';

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

const SIDEBAR_ITEMS: Node[] = [
    { id: "profile", tag: NodeTag.Item, label: "Profile 🪪" },
    { id: "tags",    tag: NodeTag.Item, label: "Tags 🏷️"   },
];

export function queryTreeItem() {
    const { data, loading, error } = useQuery<{getEditableItems: ContentItem[]}>(GET_EDITABLE_ITEMS, {
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

    return {data: treeData, loading, error};
}

export function publishUnpublishItem(id: string, publishStatus: "published" | "draft") {
    /* TODO */
}

export function createFolder(path: string, name: string) {
    /* TODO */
}

export function moveObject(newPath: string, oldPath: string) {
    /* TODO */
}

export function createArticle(path: string, name: string) {
    /* TODO */
}

export function createPodcast(path: string, name: string) {
    /* TODO */
}

export function createShot(path: string, name: string) {
    /* TODO */
}

export function createMedia(path: string, name: string) {
    /* TODO */
}