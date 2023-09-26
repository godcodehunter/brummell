import React, { SVGProps } from 'react';
import { SearchCard } from './components/SearchCard';
import { ProfileCard } from './components/ProfileCard';

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
import { globalStyles, palette } from './components/global_styles';
import StackGrid from "react-stack-grid";

interface IconButtonProps {
  url: string,
  Icon: React.FC<SVGProps<SVGSVGElement>>,
}

const IconButton: React.FC<IconButtonProps> = ({url, Icon}) => {
  const [hovered, eventHandlers] = useHover();
  return (
    <Icon 
      fill={hovered ? "#FAFAFA" : "#ABABAB"} 
      onClick={()=>window.open(url, '_blank')}
      style={{cursor: "pointer",}}
      {...eventHandlers}
    />
  );
}

const app = StyleSheet.create({
  root: {
    display:"flex", 
    flexDirection: "row", 
    minHeight: "100vh",
    backgroundColor: palette.mainColor
  },
  leftPanel: {
    height: "100%",
    display:"flex", 
    flexDirection: "column", 
    justifyContent: "flex-start",
    padding: 40,
    gap: 50,
  },
});

function App() {
  return (
    <div className={css(app.root)}>
      <div className={css(app.leftPanel)}>
        <ProfileCard 
          avatar={avatar}
          nickname={"godcodehunter"} 
          overview={
            <>
              Welcome to my blog. I am a programmer who believes that open source will take over the world, also I am Rust cultist. In my free time I am interested in microelectronics, deep topics from computer science, various code translators.
              <br/>
              I respect perseverance, uncompromising hard skills, pedantry and commitment to ideals, and with this I move towards a craftsmanship.             
            </>
          }
          social={[
            <IconButton 
              url={"https://twitter.com/godcodehunter"} 
              Icon={Twitter}
            />,
            <IconButton 
              url={"https://github.com/godcodehunter"} 
              Icon={Github}
            />,
            <IconButton 
              url={"test"} 
              Icon={Linkedin}
            />,
          ]}
        />
        <SearchCard style={{width: 300}}/>
        <TimelineCard 
          data={[]} 
          title={"TIMELINE"} 
          style={{width: 300}}
        />
      </div>
        <div 
          style={{
            width: "100%",
            display: "flex",
          }}
        >
          <StackGrid columnWidth={300} style={{width: "100%"}}>
            <div key="key2">Item 2</div>
            <div key="key3">Item 3</div>
          </StackGrid>
          {/* <div style={{
            height: "100%", 
            flexGrow: 1,
            backgroundColor: "#3F3D3D"
          }}/>
          <div style={ {
            display:"flex", 
            flexDirection: "column", 
            justifyContent: "flex-start",
            padding: 40,
            gap: 50,
          }}>
            <TimelineCard 
              data={[]} 
              title={"CONTENT"} 
              style={{width: 300}}
            />
          </div> */}
      </div>
    </div>
  );
}

export default App;
  