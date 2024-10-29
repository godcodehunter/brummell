import React, { SVGProps } from 'react';
import Markdown from 'react-markdown'
import { palette } from './global_styles';
import { globalStyles, constants } from './global_styles';
import { css } from 'aphrodite';

export const ArticlePage = () => {
    const markdown = '# Hi, *Pluto*!'
    
    return (
      <div style={{
        height: "100%",
        backgroundColor: palette.mainColor,
        
        paddingLeft: "20%",
        paddingRight: "20%",
      }}>
        <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
        <div 
          className={css(globalStyles.substrate)} 
          style={{}}
        >
          <div style={{textAlign: "center"}}>
            <span style={{
              
              fontFamily: "Monda",
              fontStyle: "normal",
              fontWeight: "normal",
              fontSize: "40px",
              lineHeight: "68px",
              color: "#D4D4D4",
            }}>
              {"headline"}
            </span>
          </div>
          <img style={{width: "100%"}} src='data:image/jpeg;base64,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'></img>
          <div style={{
            paddingLeft: constants.gap,
            paddingRight: constants.gap,
            paddingBottom: constants.gap
          }}>
            <Markdown>{markdown}</Markdown>
          </div>
        </div>
      </div>
    );
};