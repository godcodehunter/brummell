import Editor, { type OnMount } from "@monaco-editor/react";
import { StyleSheet, css } from "aphrodite";
import { TreeCard, NodeTag, Category, Node } from '../../components/TreeCard';
import { useRef, useState } from "react";
import { gql, useLazyQuery, useMutation } from "@apollo/client";

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

const styles = StyleSheet.create({
    root: {
        display: "flex",
        flexDirection: "row",
        height: "100vh",
    },
});


interface ContentItem {
    path: string;
    contentType?: "shot" | "article" | "podcast" | "library" | "media";
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

type EditingMode = "profile" | null;

export const ArticleCreator = () => {
    const [editorValue, setEditorValue] = useState("");
    const editorValueRef = useRef("");
    const editingModeRef = useRef<EditingMode>(null);

    const updateEditorValue = (next: string) => {
        editorValueRef.current = next;
        setEditorValue(next);
    };

    const [fetchOwner] = useLazyQuery<{ getOwner: Owner | null }>(GET_OWNER, {
        fetchPolicy: "network-only",
        onCompleted: data => {
            editingModeRef.current = "profile";
            updateEditorValue(profileEditTip + "\n\n" + JSON.stringify(data?.getOwner ?? null, (key, value) => key === "__typename" ? undefined : value, 4));
        },
        onError: err => {
            editingModeRef.current = null;
            updateEditorValue(`// error: ${err.message}`);
        },
    });

    const [updateOwner] = useMutation(UPDATE_OWNER);

    const stripComments = (src: string) =>
        src.split("\n").filter(line => !line.trim().startsWith("//")).join("\n").trim();

    const saveProfile = async () => {
        const jsonText = stripComments(editorValueRef.current);
        if (!jsonText) return;
        let parsed: any;
        try {
            parsed = JSON.parse(jsonText);
        } catch (e) {
            updateEditorValue(editorValueRef.current + `\n// parse error: ${(e as Error).message}`);
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
            updateEditorValue(editorValueRef.current + `\n// save error: ${(e as Error).message}`);
        }
    };

    const handleEditorMount: OnMount = (editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (editingModeRef.current === "profile") {
                saveProfile();
            }
        });
    };

    let payload: Node[] = [
        {
            id: "profile",
            tag: NodeTag.Item,
            label: "Profile 🪪",
        },
        {
            id: "tags",
            tag: NodeTag.Item,
            label: "Tags 🏷️",
        },
        {
            id: "content",
            tag: NodeTag.Category,
            label: "Content",
            children: [],
        },
    ];

    function buildPath(path: string): Category {
        const parts = path.split("/");
        let current = payload.find(item => item.label === "Content")! as Category;
        for (const part of parts) {
            let tmp = current.children.find(
                (item): item is Category => item.tag === NodeTag.Category && item.label === part,
            );
            if (!tmp) {
                tmp = {
                    tag: NodeTag.Category,
                    id: `${current.id}/${part}`,
                    label: part,
                    children: [],
                };
                current.children.push(tmp);
            }
            current = tmp;
        }

        return current;
    }

    function fillPayload(items: ContentItem[]) {
        for (const item of items) {
            let icon;
            switch (item.contentType) {
                case "shot": icon = "🎬"; break;
                case "article": icon = "📄"; break;
                case "podcast": icon = "🎙️"; break;
                case "library": icon = "⚙️"; break;
                case "media": icon = "🖼️"; break;
                default: icon = "";
            }

            let status = item.publishStatus === "published" ? "✅" : "🔨";

            const parts = item.path.split("/");
            const name = parts[parts.length - 1];
            const dirs = parts.slice(0, -1).join("/");
            const parent = dirs
                ? buildPath(dirs)
                : (payload.find(n => n.label === "Content")! as Category);

            parent.children.push({
                tag: NodeTag.Item,
                id: item.path,
                label: `${icon} ${name} ${status}`,
            });
        }
    }
    fillPayload([{
        path: "articles/2024-06-01-new-article.mdx",
        contentType: "article",
        publishStatus: "draft",
    }]);

    function onTreeItemClick(node: Node) {
        if (node.id === "profile") {
            fetchOwner();
        }
    }

    return <div className={css(styles.root)}>
        <TreeCard title="Files" data={payload} onNodeClick={onTreeItemClick} />
        <Editor
            value={editorValue}
            onChange={v => setEditorValue(v ?? "")}
            height="100%"
            defaultLanguage="mdx"
            theme="vs-dark"
            options={{
                wordWrap: "on",
                minimap: { enabled: false },
            }}
        />
    </div>
};
