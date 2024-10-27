import React, { SVGProps } from 'react';
import { SearchCard } from './components/SearchCard';
import { ProfileCard, VerticalProfileCard } from './components/ProfileCard';

import avatar from './resource/avatar.jpg';
import { ReactComponent as Github } from './resource/github.svg';
import { ReactComponent as Linkedin } from './resource/linkedin.svg';
import { ReactComponent as Twitter } from './resource/twitter.svg';
import { useHover } from './hooks';
import { TreeCard, NodeTag } from './components/TreeCard';
import { ArticleCard } from './components/ArticleCard';
import { Duration, DateTime } from 'luxon';
import { Showcase } from './components/Showcase';
import { StyleSheet, css } from 'aphrodite';
import { palette, constants } from './global_styles';
import StackGrid from "react-stack-grid";
import chroma, { Color } from 'chroma-js';
import { IconButton } from './components/InconButton';
import { gql, useQuery, useSubscription } from "@apollo/client";

const GET_LATEST_ARTICLE_COVER = gql`
  subscription GetNewArticle {
    newArticle {
      id
      author
      content
    }
  }
`;

const GET_ARTICLE_COVER = gql`
  query GetArticle {
    getArticle {
      headline,
      tags {
        tooltip
        label
        color
      },
      preview_txt,
      reading_time_min,
      publication_time,
    }
  }
`;

interface Tag {
  label: string,
  color: string,
  tooltip: string,
}

interface ArticleCover {
  headline: string,
  illustration: any,
  tags: Tag[],
  preview_txt: string,
  reading_time_min: number, 
  publication_time: number,
}

const app = StyleSheet.create({
  root: {
    // Sizing properties
    height: "100vh",

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

    // Spacing properties
    paddingTop: constants.gap,
    paddingLeft: constants.gap,
    paddingRight: constants.gap,
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

const ProfileCardWithContent = () => {
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
    avatar={avatar}
    nickname={"godcodehunter"}
    overview={overview}
    social={social}
  />;
};

function App() {
  const [articleCovers, setArticleCovers] = React.useState<ArticleCover[]>([]);
  const { data } = useQuery(GET_ARTICLE_COVER);
  
  React.useEffect(() => {
    if (data?.getArticle?.length > 0) {
      console.log(data)
      setArticleCovers(data?.getArticle);
    }
  }, [data]);

  useSubscription(GET_LATEST_ARTICLE_COVER, {
    onData: (onData) => {
      if (onData?.data) {
        // @ts-ignore 
        setArticleCovers([...articleCovers, onData?.data]);
      }
    }
  });

  return (
    <div className={css(app.root)}>
      <div className={css(app.leftPanel)}>
        <ProfileCardWithContent/>
      </div>
      <Showcase className={css(app.middlePanel)}>
        {articleCovers.map((item, idx) =>
          <ArticleCard
            style={{ width: 300 }}
            key={idx}
            headline={item.headline}
            illustration="test"
            tags={item.tags.map((i) => {
              return {
                label: i.label,
                color: chroma.hex(i.color),
                tooltip: i.tooltip,
              }
            })}
            preview_txt = {item.preview_txt}
            reading_time={Duration.fromMillis(item.reading_time_min * 60000)}
            publication_time={DateTime.fromJSDate(new Date(item.publication_time * 1000))}
            onOpen={() => { }}
          />
        )}
      </Showcase>
      <div className={css(app.rightPanel)}>
        <SearchCard />
        <TreeCard
          title={"TIMELINE"}
          data={[]}
        />
      </div>
    </div>
  );
}

export default App;
