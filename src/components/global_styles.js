import { StyleSheet } from 'aphrodite/no-important';

const GLOBALS = '__GLOBAL_STYLES__';

const globalExtension = {
  selectorHandler: (selector, baseSelector, generateSubtreeStyles) =>
    (baseSelector.includes(GLOBALS) ? generateSubtreeStyles(selector) : null),
};

const extended = StyleSheet.extend([globalExtension]);

export const globalStyles = extended.StyleSheet.create({
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
  },
  substrate: {
    backgroundColor: "#2E2E2E",
    boxShadow: "8px 8px 0px rgba(0, 0, 0, 0.25)",
  },
  headline: {
    fontWeight: "bold",
    fontSize: "12px",
    lineHeight: "26px",
    color: "#D4D4D4",
    alignItems: "center",
  },  
});

export default extended.css(globalStyles[GLOBALS]);