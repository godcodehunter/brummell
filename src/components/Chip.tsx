import React from 'react';
import { useHover} from './hooks';
import { StyleSheet, css } from 'aphrodite';
import chroma from 'chroma-js';
import { CloseInSquare } from '../resource/icons';

//rgb(78, 226, 232)
//rgb(236, 177, 148)
//rgb(91, 190, 124)
//rgb(234, 211, 181)
//rgb(227, 149, 22)
//rgb(196, 180, 233)
//rgb(253, 221, 52)
//rgb(14, 218, 78)
//rgb(215, 51, 137)
//rgb(213, 127, 189);
//rgb(28, 199, 206)
//rgb(171, 27, 8)
//rgb(146, 167, 54)
//rgb(0, 245, 198)
//rgb(128, 236, 222)
//rgb(223, 192, 66)
//rgb(186, 132, 144)
//rgb(168, 85, 120)
//rgb(236, 129, 90)
//rgb(250, 34, 80)
//rgb(145, 158, 141)

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
  color: string,
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
          color={el.color} 
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