import { StyleSheet, css } from "aphrodite";

const badge = StyleSheet.create({
  ribbon: {
    position: "absolute",
    top: "15px",
    left: "-10px",
    zIndex: 1,

    color: "#fff",

    padding: "10px 30px",

    fontWeight: "bold",
  },
  fold: {
    position: "absolute",
    left: 0,
    top: "100%",
    width: 0,
    height: 0,
    borderLeft: "10px solid transparent",
  },
});

const Badge = ({ color, text }: { color: string, text: string }) => {
  return (
    <div
      className={css(badge.ribbon)}
      style={{
        background: `linear-gradient(to right, color-mix(in srgb, ${color}, white 18%), ${color})`,
      }}
    >
      {text}
      <span
        className={css(badge.fold)}
        style={{ borderTop: `10px solid color-mix(in srgb, ${color}, black 40%)` }}
      />
    </div>
  );
};

export default Badge;
