import Editor from "@monaco-editor/react";
import { StyleSheet, css } from "aphrodite";

const styles = StyleSheet.create({
    root: {
        height: "70vh",
        minHeight: 400,
    },
});

export const ArticleCreator = () => (
    <div className={css(styles.root)}>
        <Editor
            height="100%"
            defaultLanguage="markdown"
            theme="vs-dark"
            options={{
                wordWrap: "on",
                minimap: { enabled: false },
            }}
        />
    </div>
);
