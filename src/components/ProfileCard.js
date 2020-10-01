import React from 'react';
import { StyleSheet, css } from 'aphrodite';

const profileCard = StyleSheet.create({

});

export const ProfileCard = ({avatar, nickname, overview, social}) => (
    <>
        <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
        <div style={{
            width:485, 
            height: 185, 
            backgroundColor: "#2E2E2E",
            boxShadow: "8px 8px 0px rgba(0, 0, 0, 0.25)",
        }}>
            <div style={{display: "flex"}}>
                <img src={avatar} style={{width:185, height:185, backgroundColor: "red"}}/>
                <div style={{width: "100%", display: "flex", flexDirection: "column", margin:10, }}>
                    <div style={{width: "100%", display: "flex", flexDirection: "row", justifyContent: "space-between"}}>
                        <span style={{
                            fontFamily: "Monda",
                            fontStyle: "normal",
                            fontWeight: "normal",
                            fontSize: "24px",
                            color: "#D4D4D4",
                            verticalAlign: "top",
                        }}>
                            {nickname}
                        </span>
                        <div style={{display: "flex", flexDirection: "row", gap: 4,}}>
                            {social.map((el, i)=>
                                (<div 
                                    style={{
                                        width:25, 
                                        height:25, 
                                    }}
                                    key={i}
                                >
                                    {el}
                                </div>))
                            }
                        </div>
                    </div>
                    <span style={{
                        fontFamily: "Roboto",
                        fontStyle: "normal",
                        fontWeight: "normal",
                        fontSize: "12px",
                        lineHeight: "14px",
                        color: "#D4D4D4",
                        verticalAlign: "top",
                        flexGrow: "1",
                    }}>
                        {overview}
                    </span>
                </div>
           </div>
        </div>
    </>
);
