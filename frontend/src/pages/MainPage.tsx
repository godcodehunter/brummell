import React from 'react';
import { StyleSheet, css } from 'aphrodite';
import { MasonryGrid } from '../components/MasonryGrid';
import { gql, useLazyQuery, useQuery } from "@apollo/client";
import { useNavigate } from 'react-router-dom';

import { DateTime, Duration } from 'luxon';
import chroma from 'chroma-js';

import { SearchCard } from '../components/SearchCard';
import { VerticalProfileCard } from '../components/ProfileCard';
import { Category, TreeCard, NodeTag } from '../components/TreeCard';
import { ArticleCard } from '../components/ArticleCard';
import { PodcastCard } from '../components/PodcastCard';
import { ShotCard } from '../components/ShotCard';

import { palette, constants } from '../globalStyles';

const GET_BLOG_CONTENT = gql`
  query GetBlogContent {
    getBlogContent {
      __typename
      ... on Article {
        tag
        id
        path
        headline
        illustration
        preview_txt
        reading_time_min
        createdAt
        ribbon
        tags { tooltip label color }
      }
      ... on Shot {
        tag
        id
        text
        createdAt
        tags { tooltip label color }
      }
      ... on Podcast {
        tag
        id
        path
        headline
        createdAt
        ribbon
      }
    }
  }
`;

const SEARCH_BLOG_CONTENT = gql`
  query SearchBlogContent($query: String!, $tagLabels: [String!]!, $contentTypes: [String!]!) {
    searchBlogContent(query: $query, tagLabels: $tagLabels, contentTypes: $contentTypes) {
      __typename
      ... on Article {
        tag
        id
        path
        headline
        illustration
        preview_txt
        reading_time_min
        createdAt
        ribbon
        tags { tooltip label color }
      }
      ... on Shot {
        tag
        id
        text
        createdAt
        tags { tooltip label color }
      }
      ... on Podcast {
        tag
        id
        path
        headline
        createdAt
        ribbon
      }
    }
  }
`;

interface Tag {
  label: string,
  color: string,
  tooltip: string,
}

interface ArticleItem {
  tag: "article",
  id: number,
  path: string,
  headline: string,
  illustration: any,
  tags: Tag[],
  preview_txt: string,
  reading_time_min: number,
  createdAt: number,
  ribbon: "hot" | "new" | null,
}

interface ShotItem {
  tag: "shot",
  id: number,
  text: string,
  tags: Tag[],
  createdAt: number,
}

interface PodcastItem {
  tag: "podcast",
  id: number,
  path: string,
  headline: string,
  createdAt: number,
  ribbon: "hot" | "new" | null,
}

type BlogContentItem = ArticleItem | ShotItem | PodcastItem;

interface ArticleLine {
  tag: BlogContentItem["tag"],
  id: number,
  // Shots have no path (they're text rows); kept optional so the timeline
  // can still display them without the tree node-id field.
  path?: string,
  headline: string,
  createdAt: number,
}

export const app = StyleSheet.create({
  root: {
    // Sizing properties
    height: "100vh",
    overflow: "hidden",

    // Container properties
    display: "flex",
    flexDirection: "row",

    // Styling properties
    backgroundColor: palette.mainColor,
  },
  leftPanel: {
    // Flex properties
    flex: "0 0 300px",

    // Container properties
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",

    // Spacing properties
    paddingTop: constants.gap,
    paddingLeft: constants.gap,
    gap: constants.gap,
  },
  middlePanel: {
    width: "100%",
    height: "100vh",
    overflowY: "auto",
    overflowX: "hidden",

    // Spacing properties
    paddingTop: constants.gap,
    paddingLeft: constants.gap,
    paddingRight: constants.gap,
    paddingBottom: constants.gap,
    gap: constants.gap,
  },
  rightPanel: {
    // Flex properties
    flex: "0 0 300px",

    // Container properties
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",

    // Spacing properties
    paddingTop: constants.gap,
    paddingLeft: constants.gap,
    paddingRight: constants.gap,
    gap: constants.gap,
  }
});

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

// Image-icon flavour of IconButton — the owner profile carries each ref's
// `svgIcon` as a URL/path string, not a bundled SVG component. We render
// the SVG as a CSS mask so `background-color` controls the icon colour
// (matching the original bundled-SVG palette: #ABABAB default, #FAFAFA on
// hover). Requires single-colour SVGs, which all social icons are.
const RefIcon: React.FC<{ url: string, svgIcon: string }> = ({ url, svgIcon }) => {
  const [hovered, setHovered] = React.useState(false);
  const src = resolveAssetSrc(svgIcon);
  return (
    <div
      role="link"
      onClick={() => window.open(url, "_blank")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        height: "100%",
        cursor: "pointer",
        backgroundColor: hovered ? "#FAFAFA" : "#ABABAB",
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
};

function resolveAssetSrc(src: string): string {
  if (!src) return src;
  if (/^(data:|https?:\/\/|\/)/.test(src)) return src;
  return `/files/${src}`;
}

const ProfileCardWithContent = () => {
  const { data } = useQuery(GET_OWNER);
  const owner = data?.getOwner;

  const social = (owner?.externalLinks ?? []).map(
    (l: { svgIcon: string, url: string }, i: number) =>
      <RefIcon key={i} url={l.url} svgIcon={l.svgIcon} />,
  );

  return <VerticalProfileCard
    avatar={owner?.avatar ?? ""}
    nickname={owner?.nickname ?? ""}
    overview={owner?.aboutMyself ?? ""}
    social={social}
  />;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Extra fields carried alongside each timeline node so onNodeClick knows what
// page to navigate to. Items only — categories leave these undefined.
type TimelineExt = {
  navTag?: BlogContentItem["tag"],
  navId?: number,
};

const TreeCardWithFill = ({ content }: { content: ArticleLine[] }) => {
  const navigate = useNavigate();

  // If items span more than one calendar year, qualify each group with the
  // year so "January 2025" and "January 2026" don't collapse into one bucket.
  const showYear = new Set(
    content.map(i => new Date(i.createdAt * 1000).getFullYear()),
  ).size > 1;

  const byGroup = new Map<string, ArticleLine[]>();
  for (const i of content) {
    const date = new Date(i.createdAt * 1000);
    const label = showYear
      ? `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
      : MONTHS[date.getMonth()];
    if (!byGroup.has(label)) byGroup.set(label, []);
    byGroup.get(label)!.push(i);
  }

  const data: Category<TimelineExt>[] = [];
  byGroup.forEach((items, label) => {
    data.push({
      tag: NodeTag.Category,
      id: label,
      label,
      children: items.map(i => ({
        tag: NodeTag.Item,
        // Shots have no path — fall back to `<tag>:<id>` so the Tree's
        // node id stays a valid string and uniqueness is preserved.
        id: i.path ?? `${i.tag}:${i.id}`,
        label: i.headline,
        navTag: i.tag,
        navId: i.id,
      })),
    });
  });

  return <TreeCard<TimelineExt>
    title={"TIMELINE"}
    data={data}
    onNodeClick={(node) => {
      if (node.tag !== NodeTag.Item) return;
      switch (node.navTag) {
        case "article": navigate(`/article?id=${node.navId}`); break;
        case "podcast": navigate(`/podcast?id=${node.navId}`); break;
        // shots have no dedicated page yet — ignore.
      }
    }}
  />;
};

export const MainPage = () => {
  const [items, setItems] = React.useState<BlogContentItem[]>([]);
  const { data, loading, error } = useQuery(GET_BLOG_CONTENT);

  React.useEffect(() => {
    if (data?.getBlogContent?.length > 0) {
      setItems(data.getBlogContent);
    }
  }, [data, loading, error]);

  const navigate = useNavigate();

  // Search mode — when active, the grid shows results from searchBlogContent
  // instead of the full feed. Reset returns the user to the feed.
  const [searchActive, setSearchActive] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<BlogContentItem[]>([]);
  const [runSearch] = useLazyQuery(SEARCH_BLOG_CONTENT, { fetchPolicy: "network-only" });

  const onSearch = async (
    query: string,
    tagLabels: string[],
    contentTypes: string[],
  ) => {
    const { data } = await runSearch({
      variables: { query, tagLabels, contentTypes },
    });
    setSearchResults(data?.searchBlogContent ?? []);
    setSearchActive(true);
  };

  const onResetSearch = () => {
    setSearchActive(false);
    setSearchResults([]);
  };

  const displayItems = searchActive ? searchResults : items;

  const timeline: ArticleLine[] = displayItems
    .map(i => ({
      tag: i.tag,
      id: i.id,
      path: i.tag === "shot" ? undefined : i.path,
      headline: i.tag === "shot" ? `Shot #${i.id}` : i.headline,
      createdAt: i.createdAt,
    }));

  return (
    <div className={css(app.root)}>
      <div className={css(app.leftPanel)}>
        <ProfileCardWithContent />
      </div>
      <div className={css(app.middlePanel)}>
        <MasonryGrid
          columnWidth={300}
          gutterX={constants.gap}
          gutterY={constants.gap}
        >
          {displayItems.map((item, idx) => {
            switch (item.tag) {
              case "article":
                return (
                  <ArticleCard
                    key={idx}
                    headline={item.headline}
                    illustration={item.illustration}
                    tags={item.tags.map(t => ({ ...t, color: chroma(t.color) }))}
                    preview_txt={item.preview_txt}
                    reading_time={Duration.fromObject({ minutes: item.reading_time_min })}
                    created_at={DateTime.fromSeconds(item.createdAt)}
                    onOpen={() => navigate(`/article?id=${item.id}`)}
                    ribbon={item.ribbon}
                  />
                );
              case "podcast":
                return (
                  <PodcastCard
                    key={idx}
                    headline={item.headline}
                    created_at={DateTime.fromSeconds(item.createdAt)}
                    onOpen={() => navigate(`/podcast?id=${item.id}`)}
                    ribbon={item.ribbon}
                  />
                );
              case "shot":
                return (
                  <ShotCard
                    key={idx}
                    text={item.text}
                    tags={item.tags.map(t => ({ ...t, color: chroma(t.color) }))}
                    created_at={DateTime.fromSeconds(item.createdAt)}
                  />
                );
            }
          })}
        </MasonryGrid>
      </div>
      <div className={css(app.rightPanel)}>
        <SearchCard
          onSearch={onSearch}
          onReset={onResetSearch}
          isSearchActive={searchActive}
        />
        <TreeCardWithFill content={timeline} />
      </div>
    </div>
  );
}
