import React from 'react';
import { useHover} from '../hooks';
import { StyleSheet, css } from 'aphrodite';
import chroma, { Color } from 'chroma-js';
import { CloseInSquare } from '../resource/icons';

const chip = StyleSheet.create({
  container: {
    height: 24, 
    width: "min-content",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 5,
    boxSizing: "border-box",
  },
});

interface ChipProps {
  label: string, 
  removable?: boolean, 
  onRemove?: () => void, 
  color?: string,
}

export const Chip: React.FC<ChipProps>  = ({
  label, 
  removable = false, 
  onRemove, 
  color="white"
}) => {
  const [hovered, eventHandlers] = useHover();

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
      <div 
        className={css(chip.container)} 
        style={{border: `1.5px solid ${color}`}}
      >
        <p style={{color}}>{label}</p>
        {removable && <CloseInSquare 
          style={{width: 11, height: 11, cursor: "pointer",}}
          fill={hovered ? String(chroma(color).darken().saturate(3)) : color} 
          onClick={onRemove}
          {...eventHandlers}
        />}
      </div>
    </>
  )
};

const chipHolder = StyleSheet.create({
  container: {
    display: "flex", 
    gap: 5,
  }
});

export interface Tag {
  label: string,
  color: Color,
  tooltip: string,
}

interface ChipHolderProps {
  data: Tag[],
  removable?: boolean,
  onRemove?: (index: number) => void,
  style?: any, 
} 

export const ChipHolder: React.FC<ChipHolderProps> = ({
  data, 
  removable=false, 
  onRemove, 
  style
}) => {
  return (
    <div 
      className={css(chipHolder.container)} 
      style={style}
    >
      {data.map((el, i) =>
        <Chip 
          removable={removable} 
          key={i} 
          color={el.color.hex()} 
          label={el.label} 
          onRemove={()=>{
            if(onRemove !== undefined) {
              onRemove(i);
            }
          }}
        />
      )}
    </div>
  );
};