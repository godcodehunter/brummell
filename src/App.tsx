import { createClient, SubscribePayload } from 'graphql-ws';

import React, { SVGProps } from 'react';
import { SearchCard } from './components/SearchCard';
import { ProfileCard, VerticalProfileCard } from './components/ProfileCard';

import avatar from './resource/avatar.jpg';
import { ReactComponent as Github } from './resource/github.svg';
import { ReactComponent as Linkedin } from './resource/linkedin.svg';
import { ReactComponent as Twitter } from './resource/twitter.svg';
import { useHover } from './hooks';
import { TimelineCard, NodeTag } from './components/TimelineCard';
import { ArticleCard } from './components/ArticleCard';
import { Duration, DateTime } from 'luxon';
import { Showcase } from './components/Showcase';
import { StyleSheet, css } from 'aphrodite';
import { globalStyles, palette, constants} from './components/global_styles';
import StackGrid from "react-stack-grid";
import chroma, { Color } from 'chroma-js';
import { IconButton } from './components/InconButton';

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
    paddingBottom: constants.gap,
    gap: constants.gap,
  },
  rightPanel: {
    // Spacing properties
    paddingTop: constants.gap,
    paddingLeft: constants.gap,
    paddingRight: constants.gap,
    gap: constants.gap,
  }
});

function App() {
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

  return (
    <div className={css(app.root)}>
      <div className={css(app.leftPanel)}>
        <VerticalProfileCard
          avatar={avatar}
          nickname={"godcodehunter"}
          overview={overview}
          social={social}
        />
        <SearchCard/>
        <TimelineCard
          title={"TIMELINE"}
          data={[]}
        />
      </div>
      <Showcase className={css(app.rightPanel)}>
        {[...Array(14)].map((_, i) =>
          <ArticleCard
            style={{ width: 300 }}
            key={i}
            headline="Test"
            illustration="test"
            tags={[{
              label: "Test",
              color: chroma.rgb(50, 120, 120),
              tooltip: "test",
            }]}
            reading_time={Duration.fromMillis(600000)}
            publication_time={DateTime.fromMillis(100)}
            onOpen={() => { }}
          />
        )}
      </Showcase>
    </div>
  );
}

export default App;
