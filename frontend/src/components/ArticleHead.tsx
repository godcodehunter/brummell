import React from "react";
import { StyleSheet, css } from "aphrodite";
import { globalStyles } from "../globalStyles";
import { ChipHolder, Tag } from "./Chip";
import Badge, { BAGE_VARIANTS } from "./Badge";

const HERO_OVERLAY_GRADIENT = [
    "linear-gradient(to top,",
    "rgba(0,0,0,0.85) 0%,",
    "rgba(0,0,0,0.55) 55%,",
    "rgba(0,0,0,0) 100%)",
].join(" ");

export interface MetaIntems {
    difficulty: string;
    readingTime: string;
    views: string;
    publishedAt: string;
}

export interface Article {
    bage?: "hot" | "new",
    title: string;
    preview: string;
    tags: Tag[];
    imageSrc: string;
    kicker: string;
    metaItems: MetaIntems,
}

const styles = StyleSheet.create({
    container: {
        display: "flex",
        flexDirection: "column",
        position: "relative",
    },
    heroWrap: {
        position: "relative",
        width: "100%",
    },
    hero: {
        width: "100%",
        height: 420,
        objectFit: "cover",
        display: "block",
    },
    heroOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "40px 32px 28px",
        background: HERO_OVERLAY_GRADIENT,
        display: "flex",
        flexDirection: "column",
        gap: 14,
    },
    kicker: {
        fontFamily: "Monda",
        fontSize: 11,
        fontWeight: "bold",
        letterSpacing: 4,
        color: "#FFFFFF",
        textTransform: "uppercase",
        opacity: 0.85,
    },
    title: {
        fontFamily: "Monda",
        fontSize: 48,
        fontWeight: "bold",
        lineHeight: 1.05,
        color: "#FFFFFF",
        margin: 0,
        textShadow: "0 2px 12px rgba(0,0,0,0.6)",
    },
    preview: {
        fontFamily: "Roboto",
        fontStyle: "italic",
        fontWeight: "normal",
        fontSize: 16,
        lineHeight: 1.5,
        color: "#E6E6E6",
        margin: 0,
        maxWidth: "75%",
    },
    body: {
        padding: "20px 32px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
    },
    divider: {
        height: 1,
        backgroundColor: "#4A4A4A",
    },
    footer: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
    },
    metaGroup: {
        display: "flex",
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
    },
    metaText: {
        fontFamily: "Roboto",
        fontSize: 12,
        color: "#ABABAB",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    metaLabel: {
        fontWeight: "bold",
        color: "#D4D4D4",
    },
});

const MetaItem = ({ rateName, value }: { rateName: string; value: string }) => (
    <div className={css(styles.metaGroup)}>
        <span className={css(styles.metaText, styles.metaLabel)}>{`${rateName} `}</span>
        <span className={css(styles.metaText)}>{value}</span>
    </div>
);

const Divider = () => <div className={css(styles.divider)} />;

const ArticleHero = (
    { imageSrc, kicker, title, preview }:
        Pick<Article, "imageSrc" | "kicker" | "title" | "preview">
) => (
    <div className={css(styles.heroWrap)}>
        <img className={css(styles.hero)} src={imageSrc} alt="" />
        <div className={css(styles.heroOverlay)}>
            <span className={css(styles.kicker)}>{kicker}</span>
            <h1 className={css(styles.title)}>{title}</h1>
            <p className={css(styles.preview)}>{preview}</p>
        </div>
    </div>
);

const ArticleMeta = (
    { tags, metaItems }: Pick<Article, "tags" | "metaItems">
) => {
    const metaEntries: { label: string; value: string }[] = [
        { label: "COMPLEXITY", value: metaItems.difficulty },
        { label: "READ TIME", value: metaItems.readingTime },
        { label: "VIEWS", value: metaItems.views },
        { label: "POST DATE", value: metaItems.publishedAt },
    ];
    return (
        <div className={css(styles.body)}>
            <ChipHolder data={tags} />
            <Divider />
            <div className={css(styles.footer)}>
                {metaEntries.map(({ label, value }) => (
                    <MetaItem key={label} rateName={label} value={value} />
                ))}
            </div>
        </div>
    );
};

export const ArticleHead: React.FC<{ article: Article }> = ({ article }) => (
    <div className={css(globalStyles.substrate, styles.container)}>
        {article.bage && (
            <Badge
                color={BAGE_VARIANTS[article.bage].color}
                text={BAGE_VARIANTS[article.bage].text}
            />
        )}
        <ArticleHero
            imageSrc={article.imageSrc}
            kicker={article.kicker}
            title={article.title}
            preview={article.preview}
        />
        <ArticleMeta tags={article.tags} metaItems={article.metaItems} />
    </div>
);
