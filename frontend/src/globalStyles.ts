import { StyleSheet } from 'aphrodite/no-important';

export const palette = {
  darkenedUninteractive: "#858585",
  mainColor: "#212121",
  fontColor: "#E0E0E0",
};

export const constants = {
  gap: 20,
};

export const globalStyles = StyleSheet.create({
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
  pressable: {
    cursor: "pointer",
    transition: "transform 120ms ease-out, box-shadow 120ms ease-out, background-color 120ms ease-out",
    ":hover": {
      backgroundColor: "#3A3A3A",
    },
    ":active": {
      transform: "translate(4px, 4px)",
      boxShadow: "4px 4px 0px rgba(0, 0, 0, 0.25)",
    },
  },
});