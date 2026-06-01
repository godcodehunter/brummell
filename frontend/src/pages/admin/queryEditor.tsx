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
                    id: `${item.id}/metadata`,
                    tag: NodeTag.Item,
                    label: "metadata",
                },
            ],
        };
    }

    if (item.contentType === "podcast") {
        // Podcast is now edited as a single form (sound file + guests +
        // subtitles JSON), so no more def/main pseudo-children — the row
        // itself opens the editor when clicked.
        return {
            ...item,
            tag: NodeTag.Item,
            id: item.id,
            label: `${icon} ${name} ${status}`,
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
            entityId
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

const PREVIEW_AND_SAVE_MDX = gql`
    mutation PreviewAndSaveMDX($path: String!, $source: String!) {
        previewAndSaveMDX(path: $path, source: $source) {
            code
            error
        }
    }
`;

export interface MDXBuild {
    code: string | null;
    error: string | null;
}

export function previewAndSaveMDX(path: string, source: string) {
    return client.mutate<{ previewAndSaveMDX: MDXBuild }, { path: string; source: string }>({
        mutation: PREVIEW_AND_SAVE_MDX,
        variables: { path, source },
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

const ADD_NEW_PODCAST = gql`
    mutation AddNewPodcast($headline: String!, $path: String!, $publish_status: PublishStatus!) {
        addNewPodcast(headline: $headline, path: $path, publish_status: $publish_status) {
            id
        }
    }
`;

export function createPodcast(path: string, name: string) {
    return client.mutate({
        mutation: ADD_NEW_PODCAST,
        variables: {
            headline: name,
            path: path ? `${path}/${name}` : name,
            publish_status: "draft",
        },
    });
}

const ADD_NEW_SHOT = gql`
    mutation AddNewShot($path: String!, $publish_status: PublishStatus!) {
        addNewShot(path: $path, publish_status: $publish_status) {
            id
        }
    }
`;

export function createShot(path: string, name: string) {
    return client.mutate({
        mutation: ADD_NEW_SHOT,
        variables: {
            path: path ? `${path}/${name}` : name,
            publish_status: "draft",
        },
    });
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

export interface TagRow {
    id: string;
    label: string;
    color: string;
    tooltip: string;
}

export interface TagUsageRow {
    type: "article" | "shot" | "podcast";
    id: number;
    label: string;
}

const CREATE_TAG = gql`
    mutation CreateTag($label: String!, $color: String!, $tooltip: String!) {
        createTag(label: $label, color: $color, tooltip: $tooltip) {
            id
            label
            color
            tooltip
        }
    }
`;

export function createTag(label: string, color: string, tooltip: string) {
    return client.mutate<{ createTag: TagRow }, { label: string; color: string; tooltip: string }>({
        mutation: CREATE_TAG,
        variables: { label, color, tooltip },
    });
}

const UPDATE_TAG = gql`
    mutation UpdateTag($id: Int!, $label: String!, $color: String!, $tooltip: String!) {
        updateTag(id: $id, label: $label, color: $color, tooltip: $tooltip) {
            id
            label
            color
            tooltip
        }
    }
`;

export function updateTag(id: number, label: string, color: string, tooltip: string) {
    return client.mutate<{ updateTag: TagRow }, { id: number; label: string; color: string; tooltip: string }>({
        mutation: UPDATE_TAG,
        variables: { id, label, color, tooltip },
    });
}

const DELETE_TAG = gql`
    mutation DeleteTag($id: Int!) {
        deleteTag(id: $id)
    }
`;

export function deleteTag(id: number) {
    return client.mutate<{ deleteTag: boolean }, { id: number }>({
        mutation: DELETE_TAG,
        variables: { id },
    });
}

const GET_TAG_USAGE = gql`
    query GetTagUsage($id: Int!) {
        getTagUsage(id: $id) {
            type
            id
            label
        }
    }
`;

export function getTagUsage(id: number) {
    return client.query<{ getTagUsage: TagUsageRow[] }, { id: number }>({
        query: GET_TAG_USAGE,
        variables: { id },
        fetchPolicy: "no-cache",
    });
}

export type Difficulty = "easy" | "medium" | "hard" | "extra_hard";

export interface ArticleMeta {
    path: string;
    kicker: string;
    headline: string;
    illustration: string;
    preview_txt: string;
    reading_time_min: number;
    difficulty: Difficulty;
    tags: TagRow[];
}

const GET_ARTICLE_BY_PATH = gql`
    query GetArticleByPath($path: String!) {
        getArticleByPath(path: $path) {
            path
            kicker
            headline
            illustration
            preview_txt
            reading_time_min
            difficulty
            tags {
                id
                label
                color
                tooltip
            }
        }
    }
`;

export function getArticleByPath(path: string) {
    return client.query<{ getArticleByPath: ArticleMeta | null }, { path: string }>({
        query: GET_ARTICLE_BY_PATH,
        variables: { path },
        fetchPolicy: "no-cache",
    });
}

const UPDATE_ARTICLE_META = gql`
    mutation UpdateArticleMeta(
        $path: String!
        $kicker: String!
        $headline: String!
        $illustration: String!
        $preview_txt: String!
        $reading_time_min: Int!
        $difficulty: Difficulty!
        $tagIds: [Int!]!
    ) {
        updateArticleMeta(
            path: $path
            kicker: $kicker
            headline: $headline
            illustration: $illustration
            preview_txt: $preview_txt
            reading_time_min: $reading_time_min
            difficulty: $difficulty
            tagIds: $tagIds
        ) {
            path
        }
    }
`;

type UpdateArticleMetaVars = Omit<ArticleMeta, "tags"> & { tagIds: number[] };

export function updateArticleMeta(meta: ArticleMeta) {
    return client.mutate<{ updateArticleMeta: { path: string } }, UpdateArticleMetaVars>({
        mutation: UPDATE_ARTICLE_META,
        variables: {
            path: meta.path,
            kicker: meta.kicker,
            headline: meta.headline,
            illustration: meta.illustration,
            preview_txt: meta.preview_txt,
            reading_time_min: meta.reading_time_min,
            difficulty: meta.difficulty,
            tagIds: meta.tags.map(t => Number(t.id)),
        },
    });
}

export interface ShotMeta {
    id: number;
    text: string;
    tags: TagRow[];
}

const GET_SHOT_BY_ID = gql`
    query GetShotById($id: Int!) {
        getShotById(id: $id) {
            id
            text
            tags { id label color tooltip }
        }
    }
`;

export function getShotById(id: number) {
    return client.query<{ getShotById: ShotMeta | null }, { id: number }>({
        query: GET_SHOT_BY_ID,
        variables: { id },
        fetchPolicy: "no-cache",
    });
}

const UPDATE_SHOT_META = gql`
    mutation UpdateShotMeta($id: Int!, $text: String!, $tagIds: [Int!]!) {
        updateShotMeta(id: $id, text: $text, tagIds: $tagIds) {
            id
            text
        }
    }
`;

export function updateShotMeta(meta: ShotMeta) {
    return client.mutate<
        { updateShotMeta: { id: string, text: string } },
        { id: number, text: string, tagIds: number[] }
    >({
        mutation: UPDATE_SHOT_META,
        variables: {
            // `id` arrives as a GraphQL ID (string) from getShotById; the
            // mutation declares `$id: Int!`, so coerce before sending.
            id: Number(meta.id),
            text: meta.text,
            tagIds: meta.tags.map(t => Number(t.id)),
        },
    });
}

export interface PodcastGuest {
    image: string;
    name: string;
    whoIs: string;
}

export interface PodcastSubtitleWord {
    range: { start: number, end: number };
    text: string;
}

export interface PodcastSubtitle {
    speakerIdx: number;
    words: PodcastSubtitleWord[];
}

export interface PodcastMeta {
    id: number;
    headline: string;
    preview_txt: string;
    path: string | null;
    guests: PodcastGuest[];
    subtitles: PodcastSubtitle[];
    tags: TagRow[];
}

const GET_PODCAST_BY_ID = gql`
    query GetPodcastById($id: Int!) {
        getPodcastById(id: $id) {
            id
            headline
            preview_txt
            path
            guests { image name whoIs }
            subtitles {
                speakerIdx
                words {
                    range { start end }
                    text
                }
            }
            tags { id label color tooltip }
        }
    }
`;

export function getPodcastById(id: number) {
    return client.query<{ getPodcastById: PodcastMeta | null }, { id: number }>({
        query: GET_PODCAST_BY_ID,
        variables: { id },
        fetchPolicy: "no-cache",
    });
}

const UPDATE_PODCAST_META = gql`
    mutation UpdatePodcastMeta(
        $id: Int!,
        $headline: String!,
        $preview_txt: String!,
        $path: String!,
        $guestsJson: String!,
        $subtitlesJson: String!,
        $tagIds: [Int!]!
    ) {
        updatePodcastMeta(
            id: $id,
            headline: $headline,
            preview_txt: $preview_txt,
            path: $path,
            guestsJson: $guestsJson,
            subtitlesJson: $subtitlesJson,
            tagIds: $tagIds
        ) {
            id
        }
    }
`;

export function updatePodcastMeta(meta: PodcastMeta) {
    return client.mutate<
        { updatePodcastMeta: { id: string } },
        {
            id: number,
            headline: string,
            preview_txt: string,
            path: string,
            guestsJson: string,
            subtitlesJson: string,
            tagIds: number[],
        }
    >({
        mutation: UPDATE_PODCAST_META,
        variables: {
            // `id` arrives as a GraphQL ID (string) from getPodcastById; the
            // mutation declares `$id: Int!`, so coerce before sending.
            id: Number(meta.id),
            headline: meta.headline,
            preview_txt: meta.preview_txt,
            path: meta.path ?? "",
            guestsJson: JSON.stringify(meta.guests),
            subtitlesJson: JSON.stringify(meta.subtitles),
            tagIds: meta.tags.map(t => Number(t.id)),
        },
    });
}

const GET_DELETE_IMPACT = gql`
    query GetDeleteImpact($path: String!) {
        getDeleteImpact(path: $path) {
            type
            id
            label
        }
    }
`;

export function getDeleteImpact(path: string) {
    return client.query<{ getDeleteImpact: TagUsageRow[] }, { path: string }>({
        query: GET_DELETE_IMPACT,
        variables: { path },
        fetchPolicy: "no-cache",
    });
}

const DELETE_BY_PATH = gql`
    mutation DeleteByPath($path: String!) {
        deleteByPath(path: $path)
    }
`;

export function deleteByPath(path: string) {
    return client.mutate<{ deleteByPath: boolean }, { path: string }>({
        mutation: DELETE_BY_PATH,
        variables: { path },
    });
}

const DELETE_SHOT_BY_ID = gql`
    mutation DeleteShotById($id: Int!) {
        deleteShotById(id: $id)
    }
`;

export function deleteShotById(id: number) {
    return client.mutate<{ deleteShotById: boolean }, { id: number }>({
        mutation: DELETE_SHOT_BY_ID,
        variables: { id },
    });
}

const DELETE_PODCAST_BY_ID = gql`
    mutation DeletePodcastById($id: Int!) {
        deletePodcastById(id: $id)
    }
`;

export function deletePodcastById(id: number) {
    return client.mutate<{ deletePodcastById: boolean }, { id: number }>({
        mutation: DELETE_PODCAST_BY_ID,
        variables: { id },
    });
}