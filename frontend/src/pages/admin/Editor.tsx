import Editor from "@monaco-editor/react";
import { StyleSheet, css } from "aphrodite";
import { TreeCard, NodeTag, Category, Node, type TreeCardController } from '../../components/TreeCard';
import { ContextMenu, ContextMenuItem } from '../../components/ContextMenu';
import { ErrorMsg } from '../../components/ErrorMsg';
import { TagSelector } from '../../components/TagSelector';
import { Tag } from '../../components/Chip';
import chroma from 'chroma-js';
import { SplitPane, Panel } from '../../components/SplitPane';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { previewAndSaveMDX, createArticle, createFolder, createPodcast, createShot, createTag, deleteTag, fetchPayload, getArticleByPath, getPodcastById, getShotById, getTagUsage, queryTreeItem, renameObject, savePayload, togglePublishStatus, updateArticleMeta, updatePodcastMeta, updateShotMeta, updateTag, type ArticleMeta, type Difficulty, type MDXBuild, type PodcastMeta, type ShotMeta, type TagRow, type TagUsageRow } from "./queryEditor";
import { AudioTrack } from "../../components/AudioTrack";
import { getMDXComponent } from "mdx-bundler/client";
import { globalStyles, constants, palette } from "../../globalStyles";

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
    // DB row id for article/shot/podcast (used by the form editors to
    // mutate rows whose `path` may be null and thus not addressable).
    entityId?: number;
}

// GraphQL camelCase shape — what fetchOwner actually returns.
type ProfileFormData = {
    nickname: string;
    aboutMyself: string;
    avatar: string;
    externalLinks: { svgIcon: string; url: string }[];
};

// Mirrors ProfileCard's path resolver so the in-form avatar preview matches
// what the public profile renders. Stays a local copy to avoid coupling the
// editor to ProfileCard's internals.
function resolveAssetSrc(src: string): string {
    if (!src) return src;
    if (/^(data:|https?:\/\/|\/)/.test(src)) return src;
    return `/files/${src}`;
}

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

const profileFormStyles = StyleSheet.create({
    scroller: {
        height: "100%",
        overflowY: "auto",
        backgroundColor: "#1E1E1F",
        color: "#D4D4D4",
        fontFamily: "Roboto",
        fontSize: 13,
    },
    inner: {
        maxWidth: 720,
        margin: "0 auto",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: 4,
    },
    label: {
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: "#858585",
    },
    input: {
        backgroundColor: "#2A2A2A",
        border: "1px solid #3A3A3A",
        color: "#D4D4D4",
        padding: "6px 8px",
        fontFamily: "Roboto",
        fontSize: 13,
        outline: "none",
        ":focus": { borderColor: "#6CA9E8" },
    },
    textarea: {
        backgroundColor: "#2A2A2A",
        border: "1px solid #3A3A3A",
        color: "#D4D4D4",
        padding: "6px 8px",
        fontFamily: "Roboto",
        fontSize: 13,
        outline: "none",
        resize: "vertical",
        minHeight: 96,
        ":focus": { borderColor: "#6CA9E8" },
    },
    avatarPreviewWrap: {
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        marginTop: 4,
    },
    avatarPreview: {
        width: 64,
        height: 64,
        objectFit: "cover",
        border: "1px solid #3A3A3A",
        backgroundColor: "#2A2A2A",
    },
    refsList: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
    },
    refRow: {
        display: "flex",
        gap: 6,
        alignItems: "center",
    },
    refIconInput: {
        flex: "1 1 0",
        minWidth: 0,
    },
    refUrlInput: {
        flex: "2 1 0",
        minWidth: 0,
    },
    refDelete: {
        flexShrink: 0,
        width: 28,
        height: 28,
        backgroundColor: "transparent",
        border: "1px solid #3A3A3A",
        color: "#D4D4D4",
        cursor: "pointer",
        fontSize: 16,
        lineHeight: "26px",
        padding: 0,
        ":hover": { borderColor: "#FF8A80", color: "#FF8A80" },
    },
    refAdd: {
        alignSelf: "flex-start",
        backgroundColor: "transparent",
        border: "1px dashed #3A3A3A",
        color: "#858585",
        padding: "6px 10px",
        cursor: "pointer",
        ":hover": { borderColor: "#6CA9E8", color: "#6CA9E8" },
    },
});

const tagsFormStyles = StyleSheet.create({
    rowsList: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
    },
    tagRow: {
        display: "grid",
        gridTemplateColumns: "1fr 88px 2fr 28px",
        gap: 6,
        alignItems: "center",
    },
    colorCell: {
        display: "flex",
        alignItems: "center",
        gap: 4,
    },
    colorSwatch: {
        width: 16,
        height: 16,
        border: "1px solid #3A3A3A",
        flexShrink: 0,
    },
    colorInput: {
        flex: 1,
        minWidth: 0,
    },
    modalOverlay: {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
    },
    modalBox: {
        backgroundColor: "#1E1E1F",
        border: "1px solid #3A3A3A",
        color: "#D4D4D4",
        fontFamily: "Roboto",
        fontSize: 13,
        padding: 16,
        maxWidth: 480,
        width: "90%",
        display: "flex",
        flexDirection: "column",
        gap: 12,
    },
    modalTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#FF8A80",
    },
    usageList: {
        margin: 0,
        paddingLeft: 18,
        maxHeight: 240,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2,
    },
    usageType: {
        color: "#858585",
        marginRight: 6,
        textTransform: "uppercase",
        fontSize: 11,
    },
    modalActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
    },
    btnGhost: {
        backgroundColor: "transparent",
        border: "1px solid #3A3A3A",
        color: "#D4D4D4",
        padding: "6px 12px",
        cursor: "pointer",
        ":hover": { borderColor: "#6CA9E8", color: "#6CA9E8" },
    },
    btnDanger: {
        backgroundColor: "transparent",
        border: "1px solid #FF8A80",
        color: "#FF8A80",
        padding: "6px 12px",
        cursor: "pointer",
        ":hover": { backgroundColor: "rgba(255,138,128,0.1)" },
    },
});

const noticesStyle = StyleSheet.create({
    container: {
        position: "fixed",
        right: 16,
        bottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 1000,
        maxWidth: 380,
        pointerEvents: "none",
    },
    notice: {
        pointerEvents: "auto",
    },
    progressBox: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgba(30,30,31,0.95)",
        border: "1px solid #3A3A3A",
        color: "#D4D4D4",
        fontFamily: "Roboto",
        fontSize: 12,
    },
    progressHeader: {
        padding: 4,
        textTransform: "uppercase",
        fontWeight: "bold",
        borderBottom: "1px solid #3A3A3A",
    },
    progressBody: {
        padding: 4,
    },
    progressBar: {
        height: 4,
        backgroundColor: "#3A3A3A",
        marginTop: 4,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: "#6CA9E8",
        transition: "width 80ms linear",
    },
});

type Notice =
    | { id: string, kind: "error", title: string, text: string }
    | { id: string, kind: "progress", title: string, text: string, progress: number };

const ProgressNotice: React.FC<{ title: string, text: string, progress: number }> = ({ title, text, progress }) => (
    <div className={css(noticesStyle.progressBox)}>
        <div className={css(noticesStyle.progressHeader)}>{title}</div>
        <div className={css(noticesStyle.progressBody)}>
            {text}
            <div className={css(noticesStyle.progressBar)}>
                <div className={css(noticesStyle.progressFill)} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            </div>
        </div>
    </div>
);

function parentDirOf(id: string): string {
    const parts = id.split("/");
    parts.pop();
    return parts.join("/");
}

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
    type PendingKind = "folder" | "article" | "podcast" | "shot";
    const [pendingNew, setPendingNew] = useState<{ parentId: string, kind: PendingKind } | null>(null);
    const [pendingValue, setPendingValue] = useState("");
    const submittingRef = useRef(false);

    // Rename uses the same in-tree input pattern as New Folder: the target
    // node's row is taken over by an editable input pre-populated with its
    // current name. Commit on Enter or blur, cancel on Escape or empty/unchanged.
    const [pendingRename, setPendingRename] = useState<{ targetId: string } | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const renameSubmittingRef = useRef(false);
    const renameInputRef = useRef<HTMLInputElement | null>(null);
    const treeCtrl = useRef<TreeCardController | null>(null);

    const [notices, setNotices] = useState<Notice[]>([]);
    const pushError = (title: string, text: string) => {
        const id = `err-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setNotices(p => [...p, { id, kind: "error", title, text }]);
        // Auto-dismiss; errors are surface-level signals, not log entries.
        setTimeout(() => setNotices(p => p.filter(n => n.id !== id)), 8000);
    };
    const upsertProgress = (id: string, title: string, text: string, progress: number) => {
        setNotices(p => {
            const idx = p.findIndex(n => n.id === id);
            const next: Notice = { id, kind: "progress", title, text, progress };
            if (idx === -1) return [...p, next];
            const out = p.slice();
            out[idx] = next;
            return out;
        });
    };
    const removeNotice = (id: string) => setNotices(p => p.filter(n => n.id !== id));

    // Streaming PUT via XMLHttpRequest — fetch() has no upload-progress events,
    // and we want a live percentage in the toast. `targetDir` is the parent
    // directory under FILES_DIR ("" = root); the file's own name is appended.
    const uploadFile = (targetDir: string, file: File) => {
        const id = `up-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const filePath = targetDir ? `${targetDir}/${file.name}` : file.name;
        const token = localStorage.getItem("authToken");
        upsertProgress(id, "Uploading", `${filePath} (0%)`, 0);
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `/files/${filePath}`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = e => {
            if (!e.lengthComputable) return;
            const pct = Math.round((e.loaded / e.total) * 100);
            upsertProgress(id, "Uploading", `${filePath} (${pct}%)`, pct);
        };
        xhr.onload = () => {
            removeNotice(id);
            if (xhr.status < 200 || xhr.status >= 300) {
                pushError(`Upload failed (${xhr.status})`, `${filePath}: ${xhr.responseText || xhr.statusText}`);
                return;
            }
            void refetch();
        };
        xhr.onerror = () => {
            removeNotice(id);
            pushError("Upload failed", `${filePath}: network error`);
        };
        xhr.send(file);
    };

    useEffect(() => {
        if (error) pushError("Load tree", error.message);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error]);

    const onTreeDropFiles = (node: Node<ContentItem>, files: FileList) => {
        // Sidebar pseudo-items aren't filesystem paths — silently ignore drops.
        if (node.id === "/profile" || node.id === "/tags") return;
        // Static "Content" root: upload to FILES_DIR top level.
        // Categories (incl. article/podcast folders): drop INTO the folder.
        // Items (shots, media, etc.): drop into the item's parent dir.
        let targetDir: string;
        if (node.id === "/") targetDir = "";
        else if (node.tag === NodeTag.Category) targetDir = node.id;
        else targetDir = parentDirOf(node.id);
        Array.from(files).forEach(f => uploadFile(targetDir, f));
    };

    // The input element exists in the DOM before rename starts (rendered as
    // readonly), so `autoFocus` won't fire on the transition — focus + select
    // imperatively whenever a rename begins.
    useEffect(() => {
        if (!pendingRename) return;
        const el = renameInputRef.current;
        if (!el) return;
        el.focus();
        el.select();
    }, [pendingRename]);

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
        const kind = pendingNew.kind;
        setPendingNew(null);
        setPendingValue("");
        if (!name) return;
        try {
            switch (kind) {
                case "folder":  await createFolder(parentId, name); break;
                case "article": await createArticle(parentId, name); break;
                case "podcast": await createPodcast(parentId, name); break;
                case "shot":    await createShot(parentId, name); break;
            }
            await refetch();
        } catch (e) {
            const label = kind === "folder" ? "Create folder"
                        : kind === "article" ? "Create article"
                        : kind === "podcast" ? "Create podcast"
                        : "Create shot";
            pushError(label, (e as Error).message);
        }
    };

    useEffect(() => {
        if (pendingNew) submittingRef.current = false;
    }, [pendingNew]);

    const cancelRename = () => {
        renameSubmittingRef.current = true;
        setPendingRename(null);
        setRenameValue("");
    };

    const commitRename = async () => {
        if (renameSubmittingRef.current || !pendingRename) return;
        renameSubmittingRef.current = true;
        const newName = renameValue.trim();
        const oldPath = pendingRename.targetId;
        setPendingRename(null);
        setRenameValue("");
        const oldName = lastSegment(oldPath);
        if (!newName || newName === oldName || newName.includes("/")) return;
        const parts = oldPath.split("/");
        parts[parts.length - 1] = newName;
        const newPath = parts.join("/");
        // Migrate the tree's open-set onto the new id-space before refetch.
        // Otherwise openIds keeps pointing at oldPath/* — which no longer exists
        // in the refetched data — so the renamed subtree appears collapsed.
        treeCtrl.current?.rewriteOpenIds(id =>
            id === oldPath ? newPath :
            id.startsWith(oldPath + "/") ? newPath + id.slice(oldPath.length) :
            id
        );
        try {
            await renameObject(oldPath, newPath);
        } catch (e) {
            pushError("Rename", (e as Error).message);
            await refetch();
            return;
        }
        // If the editor is currently editing a path under the renamed object,
        // rebase that path so subsequent saves hit the new location.
        const mode = editingModeRef.current;
        if (mode && typeof mode === "object" && "path" in mode) {
            if (mode.path === oldPath) {
                editingModeRef.current = { path: newPath };
            } else if (mode.path.startsWith(oldPath + "/")) {
                editingModeRef.current = { path: newPath + mode.path.slice(oldPath.length) };
            }
        }
        await refetch();
    };

    useEffect(() => {
        if (pendingRename) renameSubmittingRef.current = false;
    }, [pendingRename]);

    const viewItem = (node: Node<ContentItem>) => {
        if (pendingId && node.id === pendingId) {
            const pendingIcon =
                pendingNew?.kind === "article" ? "📄" :
                pendingNew?.kind === "podcast" ? "🎙️" :
                pendingNew?.kind === "shot" ? "🎬" : "📁";
            return (
                <div className={css(editorView.row)}>
                    <span className={css(editorView.icon)}>{pendingIcon}</span>
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
        const isRenaming = pendingRename?.targetId === node.id;
        const name = isRenaming ? renameValue : lastSegment(node.id);
        return (
            <div className={css(editorView.row)}>
                <span className={css(editorView.icon)}>{icon}</span>
                <input
                    ref={isRenaming ? renameInputRef : undefined}
                    className={css(editorView.nameField)}
                    value={name}
                    readOnly={!isRenaming}
                    // Block row's onClick only while renaming so typing/clicking
                    // inside the field doesn't try to "open" the node. When not
                    // renaming the click should bubble — that's how rows act as
                    // a "select / open" surface.
                    onClick={isRenaming ? e => e.stopPropagation() : undefined}
                    // For non-renaming readonly inputs we let the click bubble,
                    // but the input would still steal text-cursor + focus. Force
                    // the cursor back to pointer so the row reads as a button.
                    style={isRenaming ? undefined : { cursor: "pointer" }}
                    onChange={isRenaming ? e => setRenameValue(e.target.value) : undefined}
                    onBlur={isRenaming ? () => { void commitRename(); } : undefined}
                    onKeyDown={isRenaming ? e => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void commitRename();
                        } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                        }
                    } : undefined}
                />
                {status && <span className={css(editorView.icon)}>{status}</span>}
            </div>
        );
    };

    // Profile is edited as a structured form (not Monaco). When in profile
    // mode the right panel renders ProfileForm; auto-save debounces on every
    // change like the MDX editor. `profileDirtyRef` is the guard that keeps
    // the initial fetch from triggering a useless write-back.
    const [profileMode, setProfileMode] = useState(false);
    const [profileForm, setProfileForm] = useState<ProfileFormData | null>(null);
    const profileDirtyRef = useRef(false);

    const [fetchOwner] = useLazyQuery<{ getOwner: ProfileFormData | null }>(GET_OWNER, {
        fetchPolicy: "network-only",
        onCompleted: data => {
            editingModeRef.current = "profile";
            setMdxMode(false);
            setTagsMode(false);
            setMetaMode(false);
            setShotMode(false);
            setPodcastMode(false);
            setProfileMode(true);
            profileDirtyRef.current = false;
            const o = data?.getOwner;
            setProfileForm({
                nickname: o?.nickname ?? "",
                aboutMyself: o?.aboutMyself ?? "",
                avatar: o?.avatar ?? "",
                externalLinks: (o?.externalLinks ?? []).map(l => ({
                    svgIcon: l.svgIcon ?? "",
                    url: l.url ?? "",
                })),
            });
        },
        onError: err => {
            editingModeRef.current = null;
            setMdxMode(false);
            setTagsMode(false);
            setMetaMode(false);
            setShotMode(false);
            setPodcastMode(false);
            setProfileMode(false);
            pushError("Load profile", err.message);
        },
    });

    // Same dirty-flag pattern as the profile form: structured rows, auto-save
    // debounce; the initial fetch must not re-write the data back.
    type TagFormRow = { id: number, label: string, color: string, tooltip: string, dirty?: boolean };
    const [tagsMode, setTagsMode] = useState(false);
    const [tagsForm, setTagsForm] = useState<TagFormRow[] | null>(null);
    const [tagDeleteConfirm, setTagDeleteConfirm] = useState<{ id: number, label: string, usage: TagUsageRow[] } | null>(null);

    const [fetchTags] = useLazyQuery<{ getTag: TagRow[] }>(GET_TAGS, {
        fetchPolicy: "network-only",
        onCompleted: data => {
            editingModeRef.current = "tags";
            setMdxMode(false);
            setProfileMode(false);
            setMetaMode(false);
            setShotMode(false);
            setPodcastMode(false);
            setTagsMode(true);
            setTagsForm((data.getTag ?? []).map(t => ({
                id: Number(t.id),
                label: t.label,
                color: t.color,
                tooltip: t.tooltip,
            })));
        },
        onError: err => {
            editingModeRef.current = null;
            setMdxMode(false);
            setProfileMode(false);
            setMetaMode(false);
            setShotMode(false);
            setPodcastMode(false);
            setTagsMode(false);
            pushError("Load tags", err.message);
        },
    });

    const editTagRow = (id: number, mutator: (t: TagFormRow) => TagFormRow) => {
        setTagsForm(p => p ? p.map(t => t.id === id ? { ...mutator(t), dirty: true } : t) : p);
    };

    // Auto-save: debounce-flush every dirty row through updateTag in parallel.
    // Errors surface as toasts; rows keep their dirty flag if all saves fail,
    // so the next change retries them along with the new edit.
    useEffect(() => {
        if (!tagsMode || !tagsForm) return;
        const dirty = tagsForm.filter(t => t.dirty);
        if (dirty.length === 0) return;
        let cancelled = false;
        const handle = setTimeout(async () => {
            const results = await Promise.allSettled(
                dirty.map(t => updateTag(t.id, t.label, t.color, t.tooltip))
            );
            if (cancelled) return;
            const savedIds = new Set<number>();
            results.forEach((r, i) => {
                if (r.status === "fulfilled") savedIds.add(dirty[i].id);
                else pushError("Tag save", (r.reason as Error).message);
            });
            if (savedIds.size > 0) {
                setTagsForm(p => p ? p.map(t => savedIds.has(t.id) ? { ...t, dirty: false } : t) : p);
            }
        }, 400);
        return () => { cancelled = true; clearTimeout(handle); };
    }, [tagsForm, tagsMode]);

    const addTagRow = async () => {
        try {
            const { data } = await createTag("new_tag", "#888888", "");
            const created = data?.createTag;
            if (!created) return;
            setTagsForm(p => [...(p ?? []), {
                id: Number(created.id),
                label: created.label,
                color: created.color,
                tooltip: created.tooltip,
            }]);
        } catch (e) {
            pushError("Create tag", (e as Error).message);
        }
    };

    // Two-phase delete: peek at usage first, prompt the user if anything
    // references this tag. Empty usage → immediate delete (no extra click).
    const requestDeleteTag = async (row: TagFormRow) => {
        try {
            const { data } = await getTagUsage(row.id);
            const usage = data?.getTagUsage ?? [];
            if (usage.length === 0) {
                await deleteTag(row.id);
                setTagsForm(p => p ? p.filter(t => t.id !== row.id) : p);
                return;
            }
            setTagDeleteConfirm({ id: row.id, label: row.label, usage });
        } catch (e) {
            pushError("Delete tag", (e as Error).message);
        }
    };

    const confirmDeleteTag = async () => {
        if (!tagDeleteConfirm) return;
        const { id } = tagDeleteConfirm;
        setTagDeleteConfirm(null);
        try {
            await deleteTag(id);
            setTagsForm(p => p ? p.filter(t => t.id !== id) : p);
        } catch (e) {
            pushError("Delete tag", (e as Error).message);
        }
    };

    const [fetchArticle] = fetchPayload({
        onCompleted: data => {
            setEditorValue(data.getPayload);
        },
        onError: err => {
            editingModeRef.current = null;
            setMdxMode(false);
            setTagsMode(false);
            setProfileMode(false);
            setMetaMode(false);
            setShotMode(false);
            setPodcastMode(false);
            pushError("Load file", err.message);
        },
    });

    // Article metadata form: same dirty-flag pattern as profile/tags.
    // `metaPath` pins the active row so the auto-save useEffect knows
    // which article's path to PATCH against.
    const [metaMode, setMetaMode] = useState(false);
    const [metaForm, setMetaForm] = useState<ArticleMeta | null>(null);
    const metaDirtyRef = useRef(false);

    // Read-only mirror of the tag catalogue, used to look up ids by label
    // when TagSelector emits a chip (it only carries label/color/tooltip).
    // Apollo dedupes with the query that TagSelector runs internally.
    const { data: tagCatalogData } = useQuery<{ getTag: TagRow[] }>(GET_TAGS);
    const tagByLabel = useMemo(() => {
        const m = new Map<string, TagRow>();
        for (const t of tagCatalogData?.getTag ?? []) m.set(t.label, t);
        return m;
    }, [tagCatalogData]);

    const editMeta = (mutator: (m: ArticleMeta) => ArticleMeta) => {
        metaDirtyRef.current = true;
        setMetaForm(p => p ? mutator(p) : p);
    };

    const openArticleMeta = async (articlePath: string) => {
        // Ctrl+S handler only fires for profile or `{ path }` modes; null
        // here means metadata form just sits there auto-saving on edits.
        editingModeRef.current = null;
        setMdxMode(false);
        setTagsMode(false);
        setProfileMode(false);
        setShotMode(false);
        setPodcastMode(false);
        setMetaMode(true);
        metaDirtyRef.current = false;
        try {
            const { data } = await getArticleByPath(articlePath);
            const m = data.getArticleByPath;
            if (!m) throw new Error("Article not found");
            setMetaForm({ ...m });
        } catch (e) {
            setMetaMode(false);
            pushError("Load metadata", (e as Error).message);
        }
    };

    useEffect(() => {
        if (!metaMode || !metaForm) return;
        if (!metaDirtyRef.current) return;
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                await updateArticleMeta(metaForm);
            } catch (e) {
                if (!cancelled) pushError("Metadata save", (e as Error).message);
            }
        }, 400);
        return () => { cancelled = true; clearTimeout(handle); };
    }, [metaForm, metaMode]);

    // Shot meta form (just path + tags). Same dirty-flag pattern: the
    // initial fetch sets the form without flipping dirty, edits do.
    const [shotMode, setShotMode] = useState(false);
    const [shotForm, setShotForm] = useState<ShotMeta | null>(null);
    const shotDirtyRef = useRef(false);
    const editShot = (mutator: (m: ShotMeta) => ShotMeta) => {
        shotDirtyRef.current = true;
        setShotForm(p => p ? mutator(p) : p);
    };

    const openShotMeta = async (entityId: number) => {
        editingModeRef.current = null;
        setMdxMode(false);
        setTagsMode(false);
        setProfileMode(false);
        setMetaMode(false);
        setPodcastMode(false);
        setShotMode(true);
        shotDirtyRef.current = false;
        try {
            const { data } = await getShotById(entityId);
            const m = data.getShotById;
            if (!m) throw new Error("Shot not found");
            setShotForm({ ...m });
        } catch (e) {
            setShotMode(false);
            pushError("Load shot", (e as Error).message);
        }
    };

    useEffect(() => {
        if (!shotMode || !shotForm) return;
        if (!shotDirtyRef.current) return;
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                await updateShotMeta(shotForm);
                if (!cancelled) void refetch();
            } catch (e) {
                if (!cancelled) pushError("Shot save", (e as Error).message);
            }
        }, 400);
        return () => { cancelled = true; clearTimeout(handle); };
    }, [shotForm, shotMode]);

    // Podcast meta form. Subtitles are edited as raw JSON in a Monaco
    // editor — we keep both the source text and the last successfully
    // parsed value so the save uses parsed and the editor keeps the raw
    // text the user is in the middle of typing. Parse errors block save
    // and surface as an ErrMsg under the JSON editor.
    const [podcastMode, setPodcastMode] = useState(false);
    const [podcastForm, setPodcastForm] = useState<PodcastMeta | null>(null);
    const podcastDirtyRef = useRef(false);
    const [subtitlesText, setSubtitlesText] = useState("");
    const [subtitlesError, setSubtitlesError] = useState<string | null>(null);
    const editPodcast = (mutator: (m: PodcastMeta) => PodcastMeta) => {
        podcastDirtyRef.current = true;
        setPodcastForm(p => p ? mutator(p) : p);
    };

    const openPodcastMeta = async (entityId: number) => {
        editingModeRef.current = null;
        setMdxMode(false);
        setTagsMode(false);
        setProfileMode(false);
        setMetaMode(false);
        setShotMode(false);
        setPodcastMode(true);
        podcastDirtyRef.current = false;
        setSubtitlesError(null);
        try {
            const { data } = await getPodcastById(entityId);
            const m = data.getPodcastById;
            if (!m) throw new Error("Podcast not found");
            setPodcastForm({ ...m });
            setSubtitlesText(JSON.stringify(m.subtitles ?? [], null, 2));
        } catch (e) {
            setPodcastMode(false);
            pushError("Load podcast", (e as Error).message);
        }
    };

    // Validate the JSON buffer whenever it changes; on success push the
    // parsed value into podcastForm. Any structural mismatch is surfaced
    // as a human-readable error string under the editor.
    useEffect(() => {
        if (!podcastMode || !podcastForm) return;
        let parsed: unknown;
        try {
            parsed = subtitlesText.trim() === "" ? [] : JSON.parse(subtitlesText);
        } catch (e) {
            setSubtitlesError(`Parse error: ${(e as Error).message}`);
            return;
        }
        if (!Array.isArray(parsed)) {
            setSubtitlesError("Subtitles must be a JSON array of speaker rows.");
            return;
        }
        // Cheap shape check — index errors point the user at the offending row.
        for (let i = 0; i < parsed.length; i++) {
            const row = parsed[i] as { speakerIdx?: unknown, words?: unknown };
            if (typeof row?.speakerIdx !== "number") {
                setSubtitlesError(`Row ${i}: speakerIdx must be a number.`);
                return;
            }
            if (!Array.isArray(row.words)) {
                setSubtitlesError(`Row ${i}: words must be an array.`);
                return;
            }
        }
        setSubtitlesError(null);
        editPodcast(p => ({ ...p, subtitles: parsed as PodcastMeta["subtitles"] }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subtitlesText, podcastMode]);

    useEffect(() => {
        if (!podcastMode || !podcastForm) return;
        if (!podcastDirtyRef.current) return;
        // Don't save while the JSON buffer is broken — re-saving the last
        // valid subtitles would overwrite the user's in-progress edit.
        if (subtitlesError) return;
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                await updatePodcastMeta(podcastForm);
                if (!cancelled) void refetch();
            } catch (e) {
                if (!cancelled) pushError("Podcast save", (e as Error).message);
            }
        }, 400);
        return () => { cancelled = true; clearTimeout(handle); };
    }, [podcastForm, podcastMode, subtitlesError]);

    // Live MDX preview: when editing main.mdx, debounce-persist the current
    // buffer to disk and keep `mdxBuild` in sync with the compiled bundle.
    // Save and compile happen in one server round-trip via previewAndSaveMDX.
    useEffect(() => {
        if (!mdxMode) {
            setMdxBuild({ code: null, error: null });
            return;
        }
        let cancelled = false;
        const handle = setTimeout(async () => {
            const mode = editingModeRef.current;
            if (!mode || typeof mode !== "object" || !("path" in mode)) return;
            try {
                const { data } = await previewAndSaveMDX(mode.path, editorValue);
                if (!cancelled && data) setMdxBuild(data.previewAndSaveMDX);
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
            pushError("Save", (e as Error).message);
        }
    };
    const savePayloadRef = useRef(savePayloadHandler);
    savePayloadRef.current = savePayloadHandler;

    const [updateOwner] = useMutation(UPDATE_OWNER);

    // Auto-save the profile form on every keystroke (debounced). The dirty
    // ref skips the initial save that would otherwise fire when fetchOwner
    // first populates the form.
    useEffect(() => {
        if (!profileMode || !profileForm) return;
        if (!profileDirtyRef.current) return;
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                await updateOwner({
                    variables: {
                        nickname: profileForm.nickname,
                        aboutMyself: profileForm.aboutMyself,
                        avatar: profileForm.avatar,
                        externalLinks: profileForm.externalLinks,
                    },
                });
            } catch (e) {
                if (!cancelled) pushError("Profile save", (e as Error).message);
            }
        }, 400);
        return () => { cancelled = true; clearTimeout(handle); };
    }, [profileForm, profileMode]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
            if (!isSave) return;
            const mode = editingModeRef.current;
            // profile mode no longer needs Ctrl+S — it auto-saves on edit.
            if (mode && typeof mode === "object" && "path" in mode) {
                e.preventDefault();
                e.stopPropagation();
                savePayloadRef.current(mode.path);
            }
        };
        window.addEventListener("keydown", onKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
    }, []);

    // Wrap every form mutation through this — flips the dirty flag so the
    // auto-save effect knows the change came from user input, not from the
    // initial fetchOwner population.
    const editProfile = (mutator: (p: ProfileFormData) => ProfileFormData) => {
        profileDirtyRef.current = true;
        setProfileForm(p => p ? mutator(p) : p);
    };


    function onTreeItemClick(node: Node) {
        if (pendingId && node.id === pendingId) return;
        if (pendingRename && node.id === pendingRename.targetId) return;
        if (node.id === "/profile") {
            fetchOwner();
        }
        if (node.id === "/tags") {
            fetchTags();
        }
        if (node.id.endsWith("/main.mdx") && getParentNode(data, node)?.contentType === "article") {
            editingModeRef.current = { path: node.id };
            setMdxMode(true);
            setProfileMode(false);
            setTagsMode(false);
            setMetaMode(false);
            setShotMode(false);
            setPodcastMode(false);
            fetchArticle({ variables: { path: node.id } });
        }
        if (node.id.endsWith("/metadata") && getParentNode(data, node)?.contentType === "article") {
            const articlePath = node.id.slice(0, -"/metadata".length);
            void openArticleMeta(articlePath);
        }
        const ext = node as Node<ContentItem>;
        if (ext.contentType === "shot" && typeof ext.entityId === "number") {
            void openShotMeta(ext.entityId);
        }
        if (ext.contentType === "podcast" && typeof ext.entityId === "number") {
            void openPodcastMeta(ext.entityId);
        }
    }

    const menuItems = (node: Node<ContentItem>): ContextMenuItem[] => {
        if (pendingId && node.id === pendingId) return [];
        // Builder for the four "New X" menu entries — they all share the
        // same in-tree input flow (a pending row, name typed inline,
        // commit on Enter/blur, cancel on empty/Escape). `kind` decides
        // which create mutation `commitPending` dispatches.
        const newEntry = (label: string, kind: PendingKind): ContextMenuItem => ({
            label,
            onClick: () => {
                setPendingValue("");
                setPendingNew({ parentId: node.id, kind });
            },
        });
        const newFolder = newEntry("New Folder", "folder");
        const newArticle = newEntry("New Article", "article");
        const newPodcast = newEntry("New Podcast", "podcast");
        const newShot = newEntry("New Shot", "shot");
        const renameEntry = {
            label: "Rename",
            onClick: () => {
                setRenameValue(lastSegment(node.id));
                setPendingRename({ targetId: node.id });
            },
        }
        const copyPath = {
            label: "Copy path",
            onClick: () => {
                const text = `/files/${node.id}`;
                navigator.clipboard.writeText(text).catch(e =>
                    pushError("Copy path", (e as Error).message)
                );
            },
        }

        // Profile and tags are special nodes that don't represent actual content items, so we don't show any context menu for them.
        if (node.id === "/profile" || node.id === "/tags") {
            return [];
        }

        if (node.contentType === "dir") {
            let result: ContextMenuItem[] = [
                newShot,
                newArticle,
                newPodcast,
                newFolder,
            ];

            if (node.id !== "/") {
                result.unshift(renameEntry)
                result.push(copyPath);
                result.push(
                    { label: "Delete", danger: true, onClick: () => console.log("Delete", node.id) }
                )
            }

            return result;
        }

        if (node.contentType === "shot" || node.contentType === "article" || node.contentType === "podcast") {
            let result: ContextMenuItem[] = [
                {
                    label: "Toggle Publish Status",
                    onClick: async () => {
                        try {
                            await togglePublishStatus(node.id);
                            await refetch();
                        } catch (e) {
                            pushError("Toggle publish", (e as Error).message);
                        }
                    },
                },
                renameEntry,
                copyPath,
                { label: "Delete", danger: true, onClick: () => console.log("Delete", node.id) },
            ];

            if (node.contentType === "article") {
                result.unshift(newFolder);
            }

            return result;
        }

        // Mirror files ignore
        if (node.id.endsWith("/def") || node.id.endsWith("/metadata") || node.id.endsWith("/main.mdx")) {
            switch (getParentNode(data, node)?.contentType) {
                case "article":
                case "podcast":
                    return [];
            }
        }


        // Common files
        return [
            renameEntry,
            copyPath,
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
                    onNodeDropFiles={onTreeDropFiles}
                    viewItem={viewItem}
                    expandIds={[
                        ...(pendingNew ? [pendingNew.parentId] : []),
                        ...(pendingRename ? [pendingRename.targetId] : []),
                    ]}
                    controllerRef={treeCtrl}
                    style={{ height: "100%" }}
                />
            </Panel>
            <Panel flex>
                {tagsMode && tagsForm ? (
                    <div className={css(profileFormStyles.scroller)}>
                        <div className={css(profileFormStyles.inner)}>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Tags</label>
                                <div className={css(tagsFormStyles.rowsList)}>
                                    {tagsForm.map(tag => (
                                        <div key={tag.id} className={css(tagsFormStyles.tagRow)}>
                                            <input
                                                className={css(profileFormStyles.input)}
                                                placeholder="label"
                                                value={tag.label}
                                                onChange={e => editTagRow(tag.id, t => ({ ...t, label: e.target.value }))}
                                            />
                                            <div className={css(tagsFormStyles.colorCell)}>
                                                <span className={css(tagsFormStyles.colorSwatch)} style={{ backgroundColor: tag.color || "transparent" }} />
                                                <input
                                                    className={css(profileFormStyles.input, tagsFormStyles.colorInput)}
                                                    placeholder="#888"
                                                    value={tag.color}
                                                    onChange={e => editTagRow(tag.id, t => ({ ...t, color: e.target.value }))}
                                                />
                                            </div>
                                            <input
                                                className={css(profileFormStyles.input)}
                                                placeholder="tooltip"
                                                value={tag.tooltip}
                                                onChange={e => editTagRow(tag.id, t => ({ ...t, tooltip: e.target.value }))}
                                            />
                                            <button
                                                className={css(profileFormStyles.refDelete)}
                                                onClick={() => void requestDeleteTag(tag)}
                                                aria-label="Remove tag"
                                            >×</button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className={css(profileFormStyles.refAdd)}
                                    onClick={() => void addTagRow()}
                                >+ Add tag</button>
                            </div>
                        </div>
                    </div>
                ) : shotMode && shotForm ? (
                    <div className={css(profileFormStyles.scroller)}>
                        <div className={css(profileFormStyles.inner)}>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Media file</label>
                                <input
                                    className={css(profileFormStyles.input)}
                                    placeholder="path under /files or data: / http(s):// URL"
                                    value={shotForm.path ?? ""}
                                    onChange={e => editShot(m => ({ ...m, path: e.target.value }))}
                                />
                                {shotForm.path && (
                                    <div className={css(profileFormStyles.avatarPreviewWrap)}>
                                        <img
                                            className={css(profileFormStyles.avatarPreview)}
                                            src={resolveAssetSrc(shotForm.path)}
                                            alt=""
                                        />
                                    </div>
                                )}
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Tags</label>
                                <TagSelector
                                    selected={shotForm.tags.map(t => ({
                                        label: t.label,
                                        color: chroma(t.color || "#888888"),
                                        tooltip: t.tooltip,
                                    } as Tag))}
                                    onChange={next => editShot(m => ({
                                        ...m,
                                        tags: next
                                            .map(chip => tagByLabel.get(chip.label))
                                            .filter((t): t is TagRow => !!t),
                                    }))}
                                />
                            </div>
                        </div>
                    </div>
                ) : podcastMode && podcastForm ? (
                    <div className={css(profileFormStyles.scroller)}>
                        <div className={css(profileFormStyles.inner)}>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Headline</label>
                                <input
                                    className={css(profileFormStyles.input)}
                                    value={podcastForm.headline}
                                    onChange={e => editPodcast(m => ({ ...m, headline: e.target.value }))}
                                />
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Sound</label>
                                <input
                                    className={css(profileFormStyles.input)}
                                    placeholder="path under /files"
                                    value={podcastForm.path ?? ""}
                                    onChange={e => editPodcast(m => ({ ...m, path: e.target.value }))}
                                />
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Guests</label>
                                <div className={css(profileFormStyles.refsList)}>
                                    {podcastForm.guests.map((g, i) => (
                                        <div key={i} className={css(profileFormStyles.refRow)}>
                                            <input
                                                className={css(profileFormStyles.input, profileFormStyles.refIconInput)}
                                                placeholder="image (path/URL)"
                                                value={g.image}
                                                onChange={e => editPodcast(m => ({
                                                    ...m,
                                                    guests: m.guests.map((x, j) => j === i ? { ...x, image: e.target.value } : x),
                                                }))}
                                            />
                                            <input
                                                className={css(profileFormStyles.input, profileFormStyles.refIconInput)}
                                                placeholder="name"
                                                value={g.name}
                                                onChange={e => editPodcast(m => ({
                                                    ...m,
                                                    guests: m.guests.map((x, j) => j === i ? { ...x, name: e.target.value } : x),
                                                }))}
                                            />
                                            <input
                                                className={css(profileFormStyles.input, profileFormStyles.refUrlInput)}
                                                placeholder="who is"
                                                value={g.whoIs}
                                                onChange={e => editPodcast(m => ({
                                                    ...m,
                                                    guests: m.guests.map((x, j) => j === i ? { ...x, whoIs: e.target.value } : x),
                                                }))}
                                            />
                                            <button
                                                className={css(profileFormStyles.refDelete)}
                                                onClick={() => editPodcast(m => ({
                                                    ...m,
                                                    guests: m.guests.filter((_, j) => j !== i),
                                                }))}
                                                aria-label="Remove guest"
                                            >×</button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className={css(profileFormStyles.refAdd)}
                                    onClick={() => editPodcast(m => ({
                                        ...m,
                                        guests: [...m.guests, { image: "", name: "", whoIs: "" }],
                                    }))}
                                >+ Add guest</button>
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Tags</label>
                                <TagSelector
                                    selected={podcastForm.tags.map(t => ({
                                        label: t.label,
                                        color: chroma(t.color || "#888888"),
                                        tooltip: t.tooltip,
                                    } as Tag))}
                                    onChange={next => editPodcast(m => ({
                                        ...m,
                                        tags: next
                                            .map(chip => tagByLabel.get(chip.label))
                                            .filter((t): t is TagRow => !!t),
                                    }))}
                                />
                            </div>
                            {podcastForm.path && (
                                <div className={css(profileFormStyles.field)}>
                                    <label className={css(profileFormStyles.label)}>Track</label>
                                    <AudioTrack
                                        src={resolveAssetSrc(podcastForm.path)}
                                        subtitles={subtitlesError ? [] : podcastForm.subtitles}
                                        guestColors={podcastForm.guests.map((_g, idx) => ({
                                            color: chroma.hsl((idx * 73) % 360, 0.7, 0.65).hex(),
                                        }))}
                                    />
                                </div>
                            )}
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Subtitles (JSON)</label>
                                <div style={{ color: "#858585", fontSize: 12, marginBottom: 4 }}>
                                    Array of <code>{`{ speakerIdx: number, words: [{ range: { start, end }, text }] }`}</code>.
                                    Times are in seconds; <code>speakerIdx</code> indexes into the guests above.
                                </div>
                                <div style={{ border: "1px solid #3A3A3A" }}>
                                    <Editor
                                        value={subtitlesText}
                                        onChange={v => setSubtitlesText(v ?? "")}
                                        height="280px"
                                        defaultLanguage="json"
                                        theme="vs-dark"
                                        options={{
                                            wordWrap: "on",
                                            minimap: { enabled: false },
                                            lineNumbers: "off",
                                        }}
                                    />
                                </div>
                                {subtitlesError && (
                                    <div style={{ marginTop: 6 }}>
                                        <ErrorMsg title="Subtitles JSON" text={subtitlesError} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : metaMode && metaForm ? (
                    <div className={css(profileFormStyles.scroller)}>
                        <div className={css(profileFormStyles.inner)}>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Headline</label>
                                <input
                                    className={css(profileFormStyles.input)}
                                    value={metaForm.headline}
                                    onChange={e => editMeta(m => ({ ...m, headline: e.target.value }))}
                                />
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Kicker</label>
                                <input
                                    className={css(profileFormStyles.input)}
                                    value={metaForm.kicker}
                                    onChange={e => editMeta(m => ({ ...m, kicker: e.target.value }))}
                                />
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Illustration</label>
                                <input
                                    className={css(profileFormStyles.input)}
                                    placeholder="path under /files or data: / http(s):// URL"
                                    value={metaForm.illustration}
                                    onChange={e => editMeta(m => ({ ...m, illustration: e.target.value }))}
                                />
                                {metaForm.illustration && (
                                    <div className={css(profileFormStyles.avatarPreviewWrap)}>
                                        <img
                                            className={css(profileFormStyles.avatarPreview)}
                                            src={resolveAssetSrc(metaForm.illustration)}
                                            alt=""
                                        />
                                    </div>
                                )}
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Preview text</label>
                                <textarea
                                    className={css(profileFormStyles.textarea)}
                                    value={metaForm.preview_txt}
                                    onChange={e => editMeta(m => ({ ...m, preview_txt: e.target.value }))}
                                />
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Difficulty</label>
                                <select
                                    className={css(profileFormStyles.input)}
                                    value={metaForm.difficulty}
                                    onChange={e => editMeta(m => ({ ...m, difficulty: e.target.value as Difficulty }))}
                                >
                                    <option value="easy">easy</option>
                                    <option value="medium">medium</option>
                                    <option value="hard">hard</option>
                                    <option value="extra_hard">extra_hard</option>
                                </select>
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Reading time (min)</label>
                                <input
                                    type="number"
                                    min={0}
                                    className={css(profileFormStyles.input)}
                                    value={metaForm.reading_time_min}
                                    onChange={e => {
                                        const n = Number(e.target.value);
                                        editMeta(m => ({ ...m, reading_time_min: Number.isFinite(n) ? n : 0 }));
                                    }}
                                />
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Tags</label>
                                <TagSelector
                                    selected={metaForm.tags.map(t => ({
                                        label: t.label,
                                        color: chroma(t.color || "#888888"),
                                        tooltip: t.tooltip,
                                    } as Tag))}
                                    onChange={next => editMeta(m => ({
                                        ...m,
                                        // TagSelector chips don't carry ids — resolve each chip's
                                        // id from the tag catalogue (Apollo cache via tagByLabel).
                                        // Chips with no matching catalogue entry are dropped: a
                                        // tag must exist in the DB before it can be attached.
                                        tags: next
                                            .map(chip => tagByLabel.get(chip.label))
                                            .filter((t): t is TagRow => !!t),
                                    }))}
                                />
                            </div>
                        </div>
                    </div>
                ) : profileMode && profileForm ? (
                    <div className={css(profileFormStyles.scroller)}>
                        <div className={css(profileFormStyles.inner)}>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Nickname</label>
                                <input
                                    className={css(profileFormStyles.input)}
                                    value={profileForm.nickname}
                                    onChange={e => editProfile(p => ({ ...p, nickname: e.target.value }))}
                                />
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Avatar</label>
                                <input
                                    className={css(profileFormStyles.input)}
                                    placeholder="path under /files or data: / http(s):// URL"
                                    value={profileForm.avatar}
                                    onChange={e => editProfile(p => ({ ...p, avatar: e.target.value }))}
                                />
                                {profileForm.avatar && (
                                    <div className={css(profileFormStyles.avatarPreviewWrap)}>
                                        <img
                                            className={css(profileFormStyles.avatarPreview)}
                                            src={resolveAssetSrc(profileForm.avatar)}
                                            alt=""
                                        />
                                    </div>
                                )}
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Description</label>
                                <textarea
                                    className={css(profileFormStyles.textarea)}
                                    value={profileForm.aboutMyself}
                                    onChange={e => editProfile(p => ({ ...p, aboutMyself: e.target.value }))}
                                />
                            </div>
                            <div className={css(profileFormStyles.field)}>
                                <label className={css(profileFormStyles.label)}>Refs</label>
                                <div className={css(profileFormStyles.refsList)}>
                                    {profileForm.externalLinks.map((link, i) => (
                                        <div key={i} className={css(profileFormStyles.refRow)}>
                                            <input
                                                className={css(profileFormStyles.input, profileFormStyles.refIconInput)}
                                                placeholder="icon"
                                                value={link.svgIcon}
                                                onChange={e => editProfile(p => ({
                                                    ...p,
                                                    externalLinks: p.externalLinks.map((l, j) =>
                                                        j === i ? { ...l, svgIcon: e.target.value } : l),
                                                }))}
                                            />
                                            <input
                                                className={css(profileFormStyles.input, profileFormStyles.refUrlInput)}
                                                placeholder="https://…"
                                                value={link.url}
                                                onChange={e => editProfile(p => ({
                                                    ...p,
                                                    externalLinks: p.externalLinks.map((l, j) =>
                                                        j === i ? { ...l, url: e.target.value } : l),
                                                }))}
                                            />
                                            <button
                                                className={css(profileFormStyles.refDelete)}
                                                onClick={() => editProfile(p => ({
                                                    ...p,
                                                    externalLinks: p.externalLinks.filter((_, j) => j !== i),
                                                }))}
                                                aria-label="Remove ref"
                                            >×</button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className={css(profileFormStyles.refAdd)}
                                    onClick={() => editProfile(p => ({
                                        ...p,
                                        externalLinks: [...p.externalLinks, { svgIcon: "", url: "" }],
                                    }))}
                                >+ Add ref</button>
                            </div>
                        </div>
                    </div>
                ) : mdxMode ? (
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
        <div className={css(noticesStyle.container)}>
            {notices.map(n => (
                <div key={n.id} className={css(noticesStyle.notice)}>
                    {n.kind === "error"
                        ? <ErrorMsg title={n.title} text={n.text} />
                        : <ProgressNotice title={n.title} text={n.text} progress={n.progress} />}
                </div>
            ))}
        </div>
        {tagDeleteConfirm && (
            <div className={css(tagsFormStyles.modalOverlay)} onClick={() => setTagDeleteConfirm(null)}>
                <div className={css(tagsFormStyles.modalBox)} onClick={e => e.stopPropagation()}>
                    <div className={css(tagsFormStyles.modalTitle)}>
                        Delete tag "{tagDeleteConfirm.label}"?
                    </div>
                    <div>
                        This tag is currently attached to {tagDeleteConfirm.usage.length} item{tagDeleteConfirm.usage.length === 1 ? "" : "s"}.
                        Deleting it will detach the tag from every one of them.
                    </div>
                    <ul className={css(tagsFormStyles.usageList)}>
                        {tagDeleteConfirm.usage.map(u => (
                            <li key={`${u.type}-${u.id}`}>
                                <span className={css(tagsFormStyles.usageType)}>{u.type}</span>
                                {u.label || `#${u.id}`}
                            </li>
                        ))}
                    </ul>
                    <div className={css(tagsFormStyles.modalActions)}>
                        <button
                            className={css(tagsFormStyles.btnGhost)}
                            onClick={() => setTagDeleteConfirm(null)}
                        >Cancel</button>
                        <button
                            className={css(tagsFormStyles.btnDanger)}
                            onClick={() => void confirmDeleteTag()}
                        >Delete anyway</button>
                    </div>
                </div>
            </div>
        )}
    </div>
};
