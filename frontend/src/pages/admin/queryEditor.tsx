import { NodeTag, Category, Node } from '../../components/TreeCard'
import { useEffect, useMemo } from "react";
import { gql, useLazyQuery, useQuery, type LazyQueryHookOptions } from "@apollo/client";
import { ContentItem } from './Editor';
import { client } from '../../main';

/// Here `item.id`can be understood in other words as `item.path`
function reconstructTree(items: ContentItem[]): Category<ContentItem>[] {
    const root: Category<ContentItem>[] = [];

    const findCategoryAt = (
        siblings: Node<ContentItem>[],
        path: string,
    ): Category<ContentItem> | undefined =>
        siblings.find(
            (n): n is Category<ContentItem> =>
                n.tag === NodeTag.Category && (n as Category<ContentItem>).id === path,
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
        const parts = item.id.split("/");
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
            if (findCategoryAt(siblings, item.id)) continue;
            ensureCategoryAt(siblings, item.id, name, item.id);
        } else {
            siblings.push(constructNodeFromItem(item));
        }
    }

    sortTree(root as Node<ContentItem>[]);
    return root;
}

function nodeSortKey(n: Node<ContentItem>): string {
    const parts = n.id.split("/");
    return parts[parts.length - 1].toLocaleLowerCase();
}

function sortTree(nodes: Node<ContentItem>[]) {
    nodes.sort((a, b) => nodeSortKey(a).localeCompare(nodeSortKey(b)));
    for (const n of nodes) {
        if (n.tag === NodeTag.Category) sortTree(n.children);
    }
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
    
    let status = "";
    switch (item.contentType) {
        case "shot":
        case "article": 
        case "podcast":  
            status = item.publishStatus === "published" ? "✅" : "🔨"
        break;
    }

    const parts = item.id.split("/");
    const name = parts[parts.length - 1];

    if (item.contentType === "article") {
        return {
            ...item,
            tag: NodeTag.Category,
            id: item.id,
            label: `${icon} ${name} ${status}`,
            children: [
                {
                    id: `${item.id}/def`,
                    tag: NodeTag.Item,
                    label: "def.json",
                },
            ],
        };
    }

    if (item.contentType === "podcast") {
        return {
            ...item,
            tag: NodeTag.Category,
            id: item.id,
            label: `${icon} ${name} ${status}`,
            children: [
                {
                    id: `${item.id}/def`,
                    tag: NodeTag.Item,
                    label: "def.json",
                },
                {
                    id: `${item.id}/main`,
                    tag: NodeTag.Item,
                    label: "main.sound",
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
            contentType
            publishStatus
        }
    }
`;

const SIDEBAR_ITEMS: Node<ContentItem>[] = [
    { id: "/profile", tag: NodeTag.Item, label: "Profile 🪪" },
    { id: "/tags", tag: NodeTag.Item, label: "Tags 🏷️"   },
];

export function queryTreeItem() {
    const { data, loading, error, refetch } = useQuery<{getEditableItems: ContentItem[]}>(GET_EDITABLE_ITEMS, {
        fetchPolicy: "network-only",
    });

    useEffect(() => {
        console.log("Fetched editable items:", data?.getEditableItems);
        if (error) {
            console.error("Error fetching editable items:", error);
        }
    })

    const treeData = useMemo<Node<ContentItem>[]>(() => [
        ...SIDEBAR_ITEMS,
        {
            id: "/",
            tag: NodeTag.Category,
            label: "Content",
            contentType: "dir",
            children: reconstructTree(data?.getEditableItems ?? []),
        } as Node<ContentItem>,
    ], [data]);

    return {data: treeData, loading, error, refetch};
}

const TOGGLE_PUBLISH_STATUS = gql`
    mutation TogglePublishStatus($path: String!) {
        togglePublishStatus(path: $path)
    }
`;

export function togglePublishStatus(path: string) {
    return client.mutate<{ togglePublishStatus: "published" | "draft" }, { path: string }>({
        mutation: TOGGLE_PUBLISH_STATUS,
        variables: { path },
    });
}

const CREATE_FOLDER = gql`
    mutation CreateFolder($path: String!) {
        createFolder(path: $path)
    }
`;

export function createFolder(path: string, name: string) {
    return client.mutate<{ createFolder: boolean }, { path: string }>({
        mutation: CREATE_FOLDER,
        variables: { path: path ? `${path}/${name}` : name },
    });
}

const GET_PAYLOAD = gql`
    query GetPayload($path: String!) {
        getPayload(path: $path)
    }
`;

export function fetchPayload(
    options?: LazyQueryHookOptions<{ getPayload: string }, { path: string }>,
) {
    return useLazyQuery<{ getPayload: string }, { path: string }>(GET_PAYLOAD, {
        fetchPolicy: "network-only",
        ...options,
    });
}

const SET_PAYLOAD = gql`
    mutation SetPayload($path: String!, $content: String!) {
        setPayload(path: $path, content: $content)
    }
`;

export function savePayload(path: string, content: string) {
    return client.mutate<{ setPayload: boolean }, { path: string; content: string }>({
        mutation: SET_PAYLOAD,
        variables: { path, content },
    });
}

const COMPILE_MDX = gql`
    query CompileMDX($source: String!) {
        compileMDX(source: $source) {
            code
            error
        }
    }
`;

export interface MDXBuild {
    code: string | null;
    error: string | null;
}

export function compileMDX(source: string) {
    return client.query<{ compileMDX: MDXBuild }, { source: string }>({
        query: COMPILE_MDX,
        variables: { source },
        fetchPolicy: "no-cache",
    });
}

const ADD_NEW_ARTICLE = gql`
    mutation AddNewArticle(
        $kicker: String!
        $headline: String!
        $illustration: String!
        $preview_txt: String!
        $reading_time_min: Int!
        $difficulty: Difficulty!
        $path: String!
        $publish_status: PublishStatus!
    ) {
        addNewArticle(
            kicker: $kicker
            headline: $headline
            illustration: $illustration
            preview_txt: $preview_txt
            reading_time_min: $reading_time_min
            difficulty: $difficulty
            path: $path
            publish_status: $publish_status
        ) {
            id
        }
    }
`;

export function createArticle(path: string, name: string) {
    return client.mutate({
        mutation: ADD_NEW_ARTICLE,
        variables: {
            kicker: "",
            headline: name,
            illustration: "",
            preview_txt: "",
            reading_time_min: 0,
            difficulty: "easy",
            path: path ? `${path}/${name}` : name,
            publish_status: "draft",
        },
    });
}

export function createPodcast(path: string, name: string) {
    /* TODO */
}

export function createShot(path: string, name: string) {
    /* TODO */
}

const RENAME_OBJECT = gql`
    mutation RenameObject($oldPath: String!, $newPath: String!) {
        renameObject(oldPath: $oldPath, newPath: $newPath)
    }
`;

export function renameObject(oldPath: string, newPath: string) {
    return client.mutate<{ renameObject: boolean }, { oldPath: string; newPath: string }>({
        mutation: RENAME_OBJECT,
        variables: { oldPath, newPath },
    });
}