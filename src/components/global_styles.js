import { StyleSheet } from 'aphrodite/no-important';

const GLOBALS = '__GLOBAL_STYLES__';

const globalExtension = {
  selectorHandler: (selector, baseSelector, generateSubtreeStyles) =>
    (baseSelector.includes(GLOBALS) ? generateSubtreeStyles(selector) : null),
};

const extended = StyleSheet.extend([globalExtension]);

export const palette = {
  darkenedUninteractive: "#858585",
  mainColor: "#212121",
  fontColor: "#E0E0E0",
};

export const globalStyles = extended.StyleSheet.create({
  [GLOBALS]: {
    "html, body, root": {
      height: "100%", 
      margin: "0px", 
      padding: "0px",
    },
    '*, p, h1, h2, h3, h4, h5, h6, ul, dl, dt, dd': {
      fontFamily: "Monda",
      fontStyle: "normal",
      fontWeight: "normal",
      color: palette.fontColor,
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
    alignItems: "center",
  },  
});

export default extended.css(globalStyles[GLOBALS]);