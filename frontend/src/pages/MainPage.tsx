import React from 'react';
import { StyleSheet, css } from 'aphrodite';
import StackGrid from "react-stack-grid";
import { IconButton } from '../components/InconButton';
import { gql, useQuery, useSubscription } from "@apollo/client";
import { useNavigate } from 'react-router-dom';

import { DateTime, Duration } from 'luxon';
import chroma from 'chroma-js';

import { SearchCard } from '../components/SearchCard';
import { VerticalProfileCard } from '../components/ProfileCard';
import { Category, TreeCard, NodeTag } from '../components/TreeCard';
import { ArticleCard } from '../components/ArticleCard';

import avatar from '../assets/avatar.jpg';
import { ReactComponent as Github } from '../assets/github.svg';
import { ReactComponent as Linkedin } from '../assets/linkedin.svg';
import { ReactComponent as Twitter } from '../assets/twitter.svg';

import { palette, constants } from '../globalStyles';



const GET_LATEST_ARTICLE_COVER = gql`
  subscription GetNewArticle {
    newArticle {
      id
      author
      content
    }
  }
`;

const GET_BLOG_CONTENT = gql`
  query GetBlogContent {
    getBlogContent {
      __typename
      ... on Article {
        tag
        id
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
  headline: string,
  sound: string,
  createdAt: number,
}

type BlogContentItem = ArticleItem | ShotItem | PodcastItem;

interface ArticleLine {
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

const TreeCardWithFill = ({ content }: { content: ArticleLine[] }) => {
  let byMonths = new Map<string, string[]>();

  const addIfNotExist = (month: string, headline: string) => {
    if (!byMonths.has(month)) {
      byMonths.set(month, [])
    }
    // @ts-ignore
    byMonths.get(month).push(headline);
  }

  content.map((i) => {
    var date = new Date(i.createdAt * 1000);
    let month = date.getMonth()

    switch (month) {
      case 0: {
        addIfNotExist("January", i.headline)
        break;
      }
      case 1: {
        addIfNotExist("February", i.headline)
        break;
      }
      case 2: {
        addIfNotExist("March", i.headline)
        break;
      }
      case 3: {
        addIfNotExist("April", i.headline)
        break;
      }
      case 4: {
        addIfNotExist("May", i.headline)
        break;
      }
      case 5: {
        addIfNotExist("June", i.headline)
        break;
      }
      case 6: {
        addIfNotExist("July", i.headline)
        break;
      }
      case 7: {
        addIfNotExist("August", i.headline)
        break;
      }
      case 8: {
        addIfNotExist("September", i.headline)
        break;
      }
      case 9: {
        addIfNotExist("October", i.headline)
        break;
      }
      case 10: {
        addIfNotExist("November", i.headline)
        break;
      }
      case 11: {
        addIfNotExist("December", i.headline)
        break;
      }
    }
  })

  let data: Category[] = []

  byMonths.forEach((v: string[], k: string) => {
    let root: Category = {
      tag: NodeTag.Category,
      id: k,
      label: k,
      children: [],
    }
    root.children = v.map((i: string) => {
      return {
        tag: NodeTag.Item,
        id: `${k}/${i}`,
        label: i,
      }
    })
    data.push(root)
  })

  return <TreeCard
    title={"TIMELINE"}
    data={data}
  />
};

export const MainPage = () => {
  const [items, setItems] = React.useState<BlogContentItem[]>([]);
  const { data, loading, error } = useQuery(GET_BLOG_CONTENT);

  React.useEffect(() => {
    if (data?.getBlogContent?.length > 0) {
      setItems(data.getBlogContent);
    }
  }, [data, loading, error]);

  useSubscription(GET_LATEST_ARTICLE_COVER, {
    onData: (onData) => {
      if (onData?.data) {
        // @ts-ignore
        setItems([...items, onData?.data]);
      }
    }
  });

  const navigate = useNavigate();

  const timeline: ArticleLine[] = items
    .filter((i): i is ArticleItem => i.tag === "article")
    .map(i => ({ headline: i.headline, createdAt: i.createdAt }));

  return (
    <div className={css(app.root)}>
      <div className={css(app.leftPanel)}>
        <ProfileCardWithContent />
      </div>
      <div className={css(app.middlePanel)}>
        <StackGrid
          columnWidth={300}
          gutterWidth={constants.gap}
          gutterHeight={constants.gap}
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
        </StackGrid>
      </div>
      <div className={css(app.rightPanel)}>
        <SearchCard />
        <TreeCardWithFill content={timeline} />
      </div>
    </div>
  );
}
