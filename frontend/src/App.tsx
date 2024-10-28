import React, { SVGProps } from 'react';
import { SearchCard } from './components/SearchCard';
import { ProfileCard, VerticalProfileCard } from './components/ProfileCard';

import avatar from './resource/avatar.jpg';
import { ReactComponent as Github } from './resource/github.svg';
import { ReactComponent as Linkedin } from './resource/linkedin.svg';
import { ReactComponent as Twitter } from './resource/twitter.svg';
import { useHover } from './hooks';
import { Category, TreeCard, NodeTag } from './components/TreeCard';
import { ArticleCard } from './components/ArticleCard';
import { Duration, DateTime } from 'luxon';
// import { Showcase } from './components/Showcase';
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

interface ArticleLine {
  headline: string,
  publication_time: number,
}

const app = StyleSheet.create({
  root: {
    // Sizing properties
    height: "100%",

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

const TreeCardWithFill = ({content}: {content: ArticleLine[]}) => {
  let byMonths = new Map<string, string[]>();

  const addIfNotExist = (month: string, headline: string) => {
    if (!byMonths.has(month)) {
      byMonths.set(month, [])
    }
    // @ts-ignore
    byMonths.get(month).push(headline);
  }
  
  content.map((i) => {
    var date = new Date(i.publication_time * 1000);
    let month = date.getMonth()
    
    switch(month) {
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

  let data : Category[] = []
  
  byMonths.forEach((v: string[], k: string) => {
    let root : Category = {
      tag: NodeTag.Category,
      label: k,
      children: [],
    }
    root.children = v.map((i: string) => {
      return {
        tag: NodeTag.Item,
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

function App() {
  const [articleCovers, setArticleCovers] = React.useState<ArticleCover[]>([]);
  const { data } = useQuery(GET_ARTICLE_COVER);
  
  React.useEffect(() => {
    if (data?.getArticle?.length > 0) {
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
      <div className={css(app.middlePanel)}>
        <StackGrid 
          columnWidth={300} 
          gutterWidth = {constants.gap}
          gutterHeight={constants.gap}
        >
        {articleCovers.map((item, idx) =>
          <ArticleCard
            // style={{ width: 300 }}
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
        </StackGrid>
      </div>
      <div className={css(app.rightPanel)}>
        <SearchCard />
        <TreeCardWithFill content={articleCovers}/>
      </div>
    </div>
  );
}

export default App;
