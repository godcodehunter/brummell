import Editor from "@monaco-editor/react";
import { StyleSheet, css } from "aphrodite";
import { TreeCard, NodeTag, Category, Node } from '../../components/TreeCard';
import { ContextMenu, ContextMenuItem } from '../../components/ContextMenu';
import { SplitPane, Panel } from '../../components/SplitPane';
import { useEffect, useMemo, useRef, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { createFolder, queryTreeItem } from "./queryEditor";

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

const styles = StyleSheet.create({
    root: {
        display: "flex",
        flexDirection: "row",
        height: "100vh",
    },
});


export interface ContentItem {
    id: string,
    contentType?: "shot" | "article" | "podcast" | "library" | "media" | "dir";
    // Only `shot`, `article` and `podcast` can be published or draft.
    publishStatus?: "published" | "draft";
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

export const ArticleCreator = () => {
    let { data, loading, error } = queryTreeItem()
    const [editorValue, setEditorValue] = useState("");
    const [menu, setMenu] = useState<{ x: number; y: number; node: Node<ContentItem> } | null>(null);
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

    const menuItems = (node: Node<ContentItem>): ContextMenuItem[] => {
        function getParentNode(target: Node<ContentItem>): Category<ContentItem> | null {
            const walk = (nodes: Node<ContentItem>[], parent: Category<ContentItem> | null): Category<ContentItem> | null => {
                for (const n of nodes) {
                    if (n.id === target.id) return parent;
                    if (n.tag === NodeTag.Category) {
                        const found = walk(n.children, n);
                        if (found !== null) return found;
                    }
                }
                return null;
            };
            return walk(data ?? [], null);
        }

        const NewFolder = {
            label: "New Folder",
            onClick: () => createFolder(node.id, "new_folder"),
        }

        // Profile and tags are special nodes that don't represent actual content items, so we don't show any context menu for them.
        if (node.id === "/profile" || node.id === "/tags") {
            return [];
        }

        if (node.contentType === "dir") {
            let result: ContextMenuItem[] = [
                { label: "New Shot", onClick: () => console.log("New Shot in", node.id) },
                { label: "New Article", onClick: () => console.log("New Article in", node.id) },
                { label: "New Podcast", onClick: () => console.log("New Podcast in", node.id) },
                NewFolder,
            ];

            if (node.id !== "/") {
                result.unshift(
                    { label: "Rename", onClick: () => console.log("Rename", node.id) }
                )
                result.push(
                    { label: "Delete", danger: true, onClick: () => console.log("Delete", node.id) }
                )
            }

            return result;
        }

        if (node.contentType === "shot" || node.contentType === "article" || node.contentType === "podcast") {
            let result: ContextMenuItem[] = [
                { label: "Toggle Publish Status", onClick: () => console.log("Toggle Publish Status", node.id) },
                { label: "Rename", onClick: () => console.log("Rename", node.id) },
                { label: "Delete", danger: true, onClick: () => console.log("Delete", node.id) },
            ];

            if (node.contentType === "article") {
                result.unshift(NewFolder);
            }

            return result;
        }

        // Mirror files ignore
        if (node.id.endsWith("/def") || node.id.endsWith("/main")) {
            switch (getParentNode(node)?.contentType) {
                case "article":
                case "podcast":
                    return [];
            }
        }


        // Common files
        return [
            { label: "Rename", onClick: () => console.log("Rename", node.id) },
            { label: "Delete", danger: true, onClick: () => console.log("Delete", node.id) },
        ];
    }

    return <div className={css(styles.root)}>
        <SplitPane storageKey="editor-layout">
            <Panel defaultSize={260} minSize={150} maxSize={600}>
                <TreeCard
                    title="Files"
                    data={data}
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
