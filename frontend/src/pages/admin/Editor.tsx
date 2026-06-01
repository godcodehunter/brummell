import Editor from "@monaco-editor/react";
import { StyleSheet, css } from "aphrodite";
import { TreeCard, NodeTag, Category, Node } from '../../components/TreeCard';
import { ContextMenu, ContextMenuItem } from '../../components/ContextMenu';
import { SplitPane, Panel } from '../../components/SplitPane';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { compileMDX, createArticle, createFolder, fetchPayload, queryTreeItem, savePayload, type MDXBuild } from "./queryEditor";
import { getMDXComponent } from "mdx-bundler/client";
import { globalStyles, constants, palette } from "../../globalStyles";

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
    previewWrap: {
        flex: "1 1 0",
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: palette.mainColor,
        padding: constants.gap,
        boxSizing: "border-box",
    },
    previewSubstrate: {
        padding: constants.gap,
    },
    previewPlaceholder: {
        color: "#888",
        fontFamily: "Roboto",
        fontSize: 13,
    },
    errorsPane: {
        flex: "1 1 0",
        minHeight: 0,
        overflow: "auto",
        backgroundColor: "#1E1E1F",
        borderTop: "1px solid #2E2E2E",
        padding: 12,
        fontFamily: "monospace",
        fontSize: 12,
        whiteSpace: "pre-wrap",
        color: "#D4D4D4",
    },
    errorsOk: {
        color: "#7FCB7F",
    },
    errorsBad: {
        color: "#FF8A80",
    },
});

// Resets its captured render error whenever `resetKey` changes — so when the
// user edits the MDX and a new compiled `code` arrives, we re-attempt to
// render instead of being stuck on the previous failure.
class PreviewBoundary extends React.Component<
    { resetKey: unknown; children: React.ReactNode },
    { error: Error | null }
> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) { return { error }; }
    componentDidUpdate(prev: { resetKey: unknown }) {
        if (prev.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }
    render() {
        if (this.state.error) {
            return (
                <div className={css(styles.previewPlaceholder)}>
                    Render error: {this.state.error.message}
                </div>
            );
        }
        return this.props.children;
    }
}


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

function getParentNode(data: Node<ContentItem>[] | null, target: Node<ContentItem>): Category<ContentItem> | null {
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

const PENDING_NODE_TOKEN = "__pending__";

function makePendingId(parentId: string): string {
    return `${parentId}/${PENDING_NODE_TOKEN}`;
}

function injectPendingNode(nodes: Node<ContentItem>[], parentId: string, pendingId: string): Node<ContentItem>[] {
    return nodes.map(n => {
        if (n.tag !== NodeTag.Category) return n;
        if (n.id === parentId) {
            return {
                ...n,
                children: [
                    ...n.children,
                    {
                        tag: NodeTag.Category,
                        id: pendingId,
                        label: "",
                        children: [],
                        contentType: "dir",
                    } as Node<ContentItem>,
                ],
            };
        }
        return { ...n, children: injectPendingNode(n.children, parentId, pendingId) };
    });
}

function iconForContent(contentType: ContentItem["contentType"]): string {
    switch (contentType) {
        case "dir": return "📁";
        case "shot": return "🎬";
        case "article": return "📄";
        case "podcast": return "🎙️";
        case "library": return "⚙️";
        case "media": return "🖼️";
        default: return "❓";
    }
}

function publishIcon(item: ContentItem): string | null {
    switch (item.contentType) {
        case "shot":
        case "article":
        case "podcast":
            return item.publishStatus === "published" ? "✅" : "🔨";
        default:
            return null;
    }
}

function lastSegment(id: string): string {
    const parts = id.split("/");
    return parts[parts.length - 1];
}

const editorView = StyleSheet.create({
    row: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        flex: "1 1 0%",
        minWidth: 0,
        overflow: "hidden",
    },
    icon: {
        flexShrink: 0,
    },
    nameField: {
        flex: "1 1 0%",
        minWidth: 0,
        background: "transparent",
        color: "inherit",
        border: "none",
        outline: "none",
        font: "inherit",
        padding: 0,
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
});

type EditingMode = "profile" | "tags" | { path: string } | null;

export const ArticleCreator = () => {
    let { data, loading, error, refetch } = queryTreeItem()
    const [editorValue, setEditorValue] = useState("");
    const [menu, setMenu] = useState<{ x: number; y: number; node: Node<ContentItem> } | null>(null);
    const editingModeRef = useRef<EditingMode>(null);
    const [mdxMode, setMdxMode] = useState(false);
    const [mdxBuild, setMdxBuild] = useState<MDXBuild>({ code: null, error: null });
    // The user just asked us to "New Folder" somewhere — we materialize a
    // transient placeholder row in the tree under `parentId` and let the
    // viewItem render an autofocused input. Enter/blur with content commits;
    // empty value cancels.
    const [pendingNew, setPendingNew] = useState<{ parentId: string } | null>(null);
    const [pendingValue, setPendingValue] = useState("");
    const submittingRef = useRef(false);

    const pendingId = pendingNew ? makePendingId(pendingNew.parentId) : null;

    const dataWithPending = useMemo(() => {
        if (!pendingNew || !pendingId) return data;
        return injectPendingNode(data, pendingNew.parentId, pendingId);
    }, [data, pendingNew, pendingId]);

    const cancelPending = () => {
        submittingRef.current = true;
        setPendingNew(null);
        setPendingValue("");
    };

    const commitPending = async () => {
        if (submittingRef.current || !pendingNew) return;
        submittingRef.current = true;
        const name = pendingValue.trim();
        const parentId = pendingNew.parentId;
        setPendingNew(null);
        setPendingValue("");
        if (!name) return;
        await createFolder(parentId, name);
        await refetch();
    };

    useEffect(() => {
        if (pendingNew) submittingRef.current = false;
    }, [pendingNew]);

    const viewItem = (node: Node<ContentItem>) => {
        if (pendingId && node.id === pendingId) {
            return (
                <div className={css(editorView.row)}>
                    <span className={css(editorView.icon)}>📁</span>
                    <input
                        autoFocus
                        className={css(editorView.nameField)}
                        value={pendingValue}
                        onChange={e => setPendingValue(e.target.value)}
                        onBlur={() => { void commitPending(); }}
                        onKeyDown={e => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void commitPending();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelPending();
                            }
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            );
        }
        // Sidebar pseudo-items ("/profile", "/tags") and the Content root ("/")
        // are static labels — keep the original display for them.
        if (node.id.startsWith("/")) {
            return node.label;
        }
        const icon = iconForContent(node.contentType);
        const status = publishIcon(node);
        const name = lastSegment(node.id);
        return (
            <div className={css(editorView.row)}>
                <span className={css(editorView.icon)}>{icon}</span>
                <input
                    className={css(editorView.nameField)}
                    value={name}
                    readOnly
                    onClick={e => e.stopPropagation()}
                    onChange={() => { /* rename is wired separately */ }}
                />
                {status && <span className={css(editorView.icon)}>{status}</span>}
            </div>
        );
    };

    const removeInternal = (key: string, value: any) => key.startsWith("__") ? undefined : value;

    const [fetchOwner] = useLazyQuery<{ getOwner: Owner | null }>(GET_OWNER, {
        fetchPolicy: "network-only",
        onCompleted: data => {
            editingModeRef.current = "profile";
            setMdxMode(false);
            setEditorValue(profileEditTip + "\n\n" + JSON.stringify(data?.getOwner ?? null, removeInternal, 4));
        },
        onError: err => {
            editingModeRef.current = null;
            setMdxMode(false);
            setEditorValue(`// error: ${err.message}`);
        },
    });

    const [fetchTags] = useLazyQuery(GET_TAGS, {
        fetchPolicy: "network-only",
        onCompleted: data => {
            editingModeRef.current = "tags";
            setMdxMode(false);
            setEditorValue(JSON.stringify(data.getTag, removeInternal, 4));
        },
        onError: err => {
            editingModeRef.current = null;
            setMdxMode(false);
            setEditorValue(`// error: ${err.message}`);
        },
    });

    const [fetchArticle] = fetchPayload({
        onCompleted: data => {
            setEditorValue(data.getPayload);
        },
        onError: err => {
            editingModeRef.current = null;
            setMdxMode(false);
            setEditorValue(`// error: ${err.message}`);
        },
    });

    // Live MDX preview: when editing main.mdx, debounce-compile the current
    // buffer on the backend and keep `mdxBuild` in sync.
    useEffect(() => {
        if (!mdxMode) {
            setMdxBuild({ code: null, error: null });
            return;
        }
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                const { data } = await compileMDX(editorValue);
                if (!cancelled) setMdxBuild(data.compileMDX);
            } catch (e) {
                if (!cancelled) setMdxBuild({ code: null, error: (e as Error).message });
            }
        }, 400);
        return () => { cancelled = true; clearTimeout(handle); };
    }, [editorValue, mdxMode]);

    const PreviewBody = useMemo(
        () => (mdxBuild.code ? getMDXComponent(mdxBuild.code) : null),
        [mdxBuild.code],
    );

    const savePayloadHandler = async (filePath: string) => {
        try {
            await savePayload(filePath, editorValue);
        } catch (e) {
            setEditorValue(editorValue + `\n// save error: ${(e as Error).message}`);
        }
    };
    const savePayloadRef = useRef(savePayloadHandler);
    savePayloadRef.current = savePayloadHandler;

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
            const mode = editingModeRef.current;
            if (mode === "profile") {
                e.preventDefault();
                e.stopPropagation();
                saveProfileRef.current();
            } else if (mode && typeof mode === "object" && "path" in mode) {
                e.preventDefault();
                e.stopPropagation();
                savePayloadRef.current(mode.path);
            }
        };
        window.addEventListener("keydown", onKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
    }, []);


    function onTreeItemClick(node: Node) {
        if (pendingId && node.id === pendingId) return;
        if (node.id === "/profile") {
            fetchOwner();
        }
        if (node.id === "/tags") {
            fetchTags();
        }
        if (node.id.endsWith("/main.mdx") && getParentNode(data, node)?.contentType === "article") {
            editingModeRef.current = { path: node.id };
            setMdxMode(true);
            fetchArticle({ variables: { path: node.id } });
        }
    }

    const menuItems = (node: Node<ContentItem>): ContextMenuItem[] => {
        if (pendingId && node.id === pendingId) return [];
        const newFolder = {
            label: "New Folder",
            onClick: () => {
                setPendingValue("");
                setPendingNew({ parentId: node.id });
            },
        }
        const newArticle = {
            label: "New Article",
            onClick: () => createArticle(node.id, "new_article")
        }

        // Profile and tags are special nodes that don't represent actual content items, so we don't show any context menu for them.
        if (node.id === "/profile" || node.id === "/tags") {
            return [];
        }

        if (node.contentType === "dir") {
            let result: ContextMenuItem[] = [
                { label: "New Shot", onClick: () => console.log("New Shot in", node.id) },
                newArticle,
                { label: "New Podcast", onClick: () => console.log("New Podcast in", node.id) },
                newFolder,
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
                result.unshift(newFolder);
            }

            return result;
        }

        // Mirror files ignore
        if (node.id.endsWith("/def") || node.id.endsWith("/main.mdx")) {
            switch (getParentNode(data, node)?.contentType) {
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
                <TreeCard<ContentItem>
                    title="Files"
                    data={dataWithPending}
                    onNodeClick={onTreeItemClick}
                    onNodeRightClick={(node, e) => setMenu({ x: e.clientX, y: e.clientY, node })}
                    viewItem={viewItem}
                    expandIds={pendingNew ? [pendingNew.parentId] : undefined}
                    style={{ height: "100%" }}
                />
            </Panel>
            <Panel flex>
                {mdxMode ? (
                    <SplitPane storageKey="editor-mdx-layout">
                        <Panel flex>
                            <Editor
                                value={editorValue}
                                onChange={v => setEditorValue(v ?? "")}
                                height="100%"
                                defaultLanguage="markdown"
                                theme="vs-dark"
                                options={{
                                    wordWrap: "on",
                                    minimap: { enabled: false },
                                }}
                            />
                        </Panel>
                        <Panel defaultSize={500} minSize={240}>
                            <SplitPane direction="vertical" storageKey="editor-mdx-preview-layout">
                                <Panel flex>
                                    <div className={css(styles.previewWrap)}>
                                        <div className={`${css(globalStyles.substrate, styles.previewSubstrate)} article-section`}>
                                            <PreviewBoundary resetKey={mdxBuild.code}>
                                                {PreviewBody
                                                    ? <PreviewBody />
                                                    : <div className={css(styles.previewPlaceholder)}>
                                                        {mdxBuild.error ? "Compile error — see panel below." : "Compiling preview…"}
                                                    </div>}
                                            </PreviewBoundary>
                                        </div>
                                    </div>
                                </Panel>
                                <Panel defaultSize={160} minSize={40}>
                                    <div className={css(styles.errorsPane, mdxBuild.error ? styles.errorsBad : styles.errorsOk)}>
                                        {mdxBuild.error ?? "No MDX errors."}
                                    </div>
                                </Panel>
                            </SplitPane>
                        </Panel>
                    </SplitPane>
                ) : (
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
                )}
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
