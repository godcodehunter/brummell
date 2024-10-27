import React, { useState, useEffect } from 'react';
import { useSpring, animated } from 'react-spring';
import { useMeasure } from '../hooks';
import { StyleSheet, css } from 'aphrodite';

const loadingIndicator = StyleSheet.create({
    slider: {
        width: "100%", 
        height: "3px",
        background: "#3F3D3D",
    },
    line: {
        opacity: "0.4",
        background: "#4a8df8",
    }
});

export const LoadingIndicator = ({ color="white" }) => {
    const [bind, { width: widthHeight }] = useMeasure();
    const [props, set] = useSpring(() => ({
        // from: {wi}, 
        to: async next => {
            while(1) {
                // await next({left: "-5%", width: "5%"})
                // await next({left: "130%", width: "100%"}) 
                await next({width: "0%"})
                await next({width: "100%"})
            }
        },
    }));

    return (
        <div 
            {...bind}
            className={css(loadingIndicator.slider)}
        >
            <animated.div 
                style={{
                    ...props,
                    height: "100%", 
                    background: color,
                }}
            />

        </div>
    );
};