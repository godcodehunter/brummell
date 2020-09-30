import { StyleSheet } from 'aphrodite/no-important';

const GLOBALS = '__GLOBAL_STYLES__';

const globalExtension = {
  selectorHandler: (selector, baseSelector, generateSubtreeStyles) =>
    (baseSelector.includes(GLOBALS) ? generateSubtreeStyles(selector) : null),
};

const extended = StyleSheet.extend([globalExtension]);

const styles = extended.StyleSheet.create({
  [GLOBALS]: {
    "html, body, root": {
      height: "100%", 
      margin: "0px", 
      padding: "0px",
      backgroundColor: "#212121", 
    },
    '*, p, h1, h2, h3, h4, h5, h6, ul, dl, dt, dd': {
      fontFamily: "Roboto",
      fontStyle: "normal",
      fontWeight: "normal",
      fontSize: "14px",
      color: "#E0E0E0",
    },
  }
});

export default extended.css(styles[GLOBALS]);