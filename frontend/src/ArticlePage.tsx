import React, { SVGProps } from 'react';
import Markdown from 'react-markdown'
import { app } from './App';
import { StyleSheet, css } from 'aphrodite';

export const ArticlePage = () => {
    const markdown = '# Hi, *Pluto*!'
    
    return (
      <div className={css(app.root)} style={{}}>
        <Markdown>{markdown}</Markdown>
      </div>
    );
};