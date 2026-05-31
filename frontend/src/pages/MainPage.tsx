import React from 'react';
import { StyleSheet, css } from 'aphrodite';
import { MasonryGrid } from '../components/MasonryGrid';
import { IconButton } from '../components/InconButton';
import { gql, useQuery } from "@apollo/client";
import { useNavigate } from 'react-router-dom';

import { DateTime, Duration } from 'luxon';
import chroma from 'chroma-js';

import { SearchCard } from '../components/SearchCard';
import { VerticalProfileCard } from '../components/ProfileCard';
import { Category, TreeCard, NodeTag } from '../components/TreeCard';
import { ArticleCard } from '../components/ArticleCard';


import { ReactComponent as Github } from '../assets/github.svg';
import { ReactComponent as Linkedin } from '../assets/linkedin.svg';
import { ReactComponent as Twitter } from '../assets/twitter.svg';

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
        tags { tooltip label color }
      }
      ... on Shot {
        tag
        id
        path
        createdAt
      }
      ... on Podcast {
        tag
        id
        path
        headline
        sound
        createdAt
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
}

interface ShotItem {
  tag: "shot",
  id: number,
  path: string,
  createdAt: number,
}

interface PodcastItem {
  tag: "podcast",
  id: number,
  path: string,
  headline: string,
  sound: string,
  createdAt: number,
}

type BlogContentItem = ArticleItem | ShotItem | PodcastItem;

interface ArticleLine {
  path: string,
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

const ProfileCardWithContent = () => {
  const { data, loading, error } = useQuery(GET_OWNER);

  const overview =
  <>
    Welcome to my blog. I am a programmer who believes that open source
    will take over the world, also I am Rust cultist. In my free time
    I am interested in microelectronics, deep topics from computer
    science, various code translators.
    <br />
    I respect perseverance, uncompromising hard skills, pedantry and
    commitment to ideals, and with this I move towards a craftsmanship.
  </>
  
  const social = [
    <IconButton
      url={"https://x.com/godcodehunter"}
      Icon={Twitter}
    />,
    <IconButton
      url={"https://github.com/godcodehunter"}
      Icon={Github}
    />,
    <IconButton
      url={"https://www.linkedin.com/in/dmitry-opokin/"}
      Icon={Linkedin}
    />
  ];

  return <VerticalProfileCard
    avatar={data?.getOwner?.avatar}
    nickname={data?.getOwner?.nickname}
    overview={data?.getOwner?.aboutMyself}
    social={social}
  />;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TreeCardWithFill = ({ content }: { content: ArticleLine[] }) => {
  // If items span more than one calendar year, qualify each group with the
  // year so "January 2025" and "January 2026" don't collapse into one bucket.
  const showYear = new Set(
    content.map(i => new Date(i.createdAt * 1000).getFullYear()),
  ).size > 1;

  const byGroup = new Map<string, { headline: string, path: string }[]>();
  for (const i of content) {
    const date = new Date(i.createdAt * 1000);
    const label = showYear
      ? `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
      : MONTHS[date.getMonth()];
    if (!byGroup.has(label)) byGroup.set(label, []);
    byGroup.get(label)!.push({ headline: i.headline, path: i.path });
  }

  const data: Category[] = [];
  byGroup.forEach((items, label) => {
    data.push({
      tag: NodeTag.Category,
      id: label,
      label,
      children: items.map(({ headline, path }) => ({
        tag: NodeTag.Item,
        id: path,
        label: headline,
      })),
    });
  });

  return <TreeCard title={"TIMELINE"} data={data} />;
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

  const timeline: ArticleLine[] = items
    .map(i => ({ 
      path: i.path, 
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
          {items.map((item, idx) => {
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
                  />
                );
              case "shot":
              case "podcast":
                return null;
            }
          })}
        </MasonryGrid>
      </div>
      <div className={css(app.rightPanel)}>
        <SearchCard />
        <TreeCardWithFill content={timeline} />
      </div>
    </div>
  );
}
