import React, { useState, useEffect } from 'react';
import { StyleSheet, css } from 'aphrodite';
import { useSpring, animated } from 'react-spring'
import { ReactComponent as Arrow } from '../resource/arrow.svg';
import { useHover } from '../hooks';

const autocomplete = StyleSheet.create({
    field: {
        border: "0.4px solid #ABABAB", 
        boxSizing: "border-box",
        backgroundColor: "#3F3D3D", 
        display: "flex",  
        flexDirection: "column",
    },
    input: {
        flexGrow: 1,
        backgroundColor: "rgba(0, 0, 0, 0)", 
        border: "none",
        paddingLeft: 5,
        ':hover': {
            outline: "none",
        },
        ':focus': {
            outline: "none",
        }
    }
});

interface AutocompleteProps {
    onSelect: () => void,
    renderInput: (params: any) => JSX.Element,
    variants: any[],
    filter: (input: string, variants: any) => any,
}

export const Autocomplete: React.FC<AutocompleteProps> = ({
    onSelect,
    variants,
    renderInput,
    filter,
}) => {
    const [hovered, eventHandlers] = useHover();
    const [text, setText] = useState("");
    const [isOpen, setOpen] = useState(false);
    
    const LL = isOpen || text.length > 0;
    const props = useSpring({height: LL ? 160 : 25, from: {height: 25}});
    
    useEffect(() => {
        console.log(variants, filter(text, {source: [{list: variants}] }));
    }, [text]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setText(event.target.value);
        if(text === "" && isOpen){
            setOpen(false);
        };
    };
    
    const [focused, setFocus] = useState();
    
    enum keyCode {
        ArrowUp = 38, 
        ArrowDown = 40, 
        Enter = 13,
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        switch(event.keyCode) {
            case keyCode.ArrowUp:
                if(focused === variants[0]) {
                    setFocus(undefined);
                    setOpen(false);
                }
                if(focused !== undefined) {
                    setFocus(variants[variants.indexOf(focused)-1]);
                }
                break;
            case keyCode.ArrowDown:
                if(!isOpen) {
                    setOpen(true);
                }
                if(focused !== undefined) {
                    if(variants.indexOf(focused) != variants.length-1) {
                        setFocus(variants[variants.indexOf(focused)+1]);
                    }
                } else {
                    setFocus(variants[0]);
                }
                break;
            case keyCode.Enter:
                break;
        }
    };

    return (
        <animated.div 
            className={css(autocomplete.field)} 
            style={props}
            onKeyDown={onKeyDown}
        >
            <div style={{
                display: "flex",  
                flexDirection: "row",
                height: 25,
            }}>
                <input className={css(autocomplete.input)} value={text} onChange={handleChange}/>
                <Arrow 
                    style={{display: "block", margin: "auto", height: "100%", width: 25, cursor: "pointer",}}
                    stroke={hovered ?  "#FAFAFA": "#ABABAB"}
                    {...eventHandlers}
                    onClick={() => setOpen(!isOpen)}
                />
            </div>
            <div className={"kek"} style={{
                backgroundColor: "#1E1E1F", 
                overflowX: "auto",
            }}>
                {variants.map((e, i) => (
                <div 
                    key={i} 
                    style={{
                        cursor: "pointer",
                        backgroundColor: focused === e ? "red" : undefined,
                        height: 25,
                    }}
                    onClick={()=> setFocus(e)}
                >
                    1
                </div>
                ))}
            </div>
        </animated.div>
    );
};