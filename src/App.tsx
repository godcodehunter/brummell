import React, { SVGProps } from 'react';
import { SpringGrid } from 'react-stonecutter';
import { SearchCard } from './components/SearchCard';
import { ProfileCard } from './components/ProfileCard';

import avatar from './resource/avatar.jpg';
import { ReactComponent as Github } from './resource/github.svg';
import { ReactComponent as Linkedin } from './resource/linkedin.svg';
import { ReactComponent as Twitter } from './resource/twitter.svg';
import { useHover } from './components/hooks';
import { TimelineCard } from './components/TimelineCard';
import { ArticleCard } from './components/ArticleCard';
import { Duration, DateTime } from 'luxon';
import chroma from 'chroma-js';
import { StyleSheet, css } from 'aphrodite';

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
    alignItems: "stretch",
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
        <TimelineCard style={{width: 300}}/>
      </div>
        {/* <SpringGrid  
          columns={4}
          columnWidth={420}
          gutterWidth={5}
          gutterHeight={5}
          itemHeight={380}
          springConfig={{ stiffness: 170, damping: 26 }}
        >
          {[0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0].map((e, i) => 
            <div key={i} style={{backgroundColor: "red", width: 400}} >
              <ArticleCard 
                key={i} 
                style={{height: "100%", width: "100%"}}
                illustration={avatar}
                headline="Test"
                tags={[{label: "Electronic", color: String(chroma.random()), tooltip: "test1"}]}
                onOpen={()=>{ console.log("test"); }}
                reading_time={Duration.fromObject({ days: 1, minute: 2 })}
                publication_time={DateTime.fromISO("2020-09-27")}
              />
            </div>
          )}
        </SpringGrid>  */}
    </div>
  );
}

export default App;
