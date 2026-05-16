
import React from 'react';
import chroma, { Color } from 'chroma-js';


export const ErrorMsg = ({ title, text }: { title: string, text: string }) => {
  const color = "rgba(253, 2, 2, 1)";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          border: `0.4px solid ${color}`,
          backgroundColor: String(chroma(color).alpha(0.2))
        }}
      >
        <div style={{
          padding: "4px",
          color,
          textTransform: "uppercase",
          borderBottom: `0.4px solid ${color}`,
          fontFamily: "Roboto",
          fontWeight: "bold",
          fontSize: 12,
        }}>
          {`ERROR - ${title}`}
        </div>
        <div style={{ color, padding: "4px", }}>{text}</div>
      </div>
    </>
  )
};