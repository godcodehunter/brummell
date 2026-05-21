import Editor from "@monaco-editor/react";
import { StyleSheet, css } from "aphrodite";
import { TreeCard, NodeTag, Category, Node } from '../../components/TreeCard';

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

export const ArticleCreator = () => {
    let payload: Node[]= [
        {
            id: "0",
            tag: NodeTag.Item,
            label: "Profile 🪪",
        },
        {
            id: "1",
            tag: NodeTag.Item,
            label: "Tags 🏷️",
        },
        {
            id: "2",
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

    return <div className={css(styles.root)}>
        <TreeCard title="Files" data={payload} />
        <Editor
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
