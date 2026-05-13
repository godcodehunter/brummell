import React, { useState } from 'react';
import { StyleSheet, css } from 'aphrodite';
import { globalStyles, palette } from '../globalStyles';

const chat = StyleSheet.create({
    titleCard: {
        position: "sticky",
        top: 0,
        zIndex: 10,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    title: {
        fontFamily: "Monda",
        fontSize: 14,
        fontWeight: "bold",
        color: palette.darkenedUninteractive,
        letterSpacing: 2,
    },
    count: {
        fontFamily: "Monda",
        fontSize: 14,
        fontWeight: "bold",
        color: palette.darkenedUninteractive,
        letterSpacing: 2,
    },
    scroll: {
        display: "flex",
        flexDirection: "column",
        gap: 32,
        padding: "0 10px",
        overflowY: "auto",
        minHeight: 0,
        flex: 1,
    },
    cardWrap: {
        position: "relative",
    },
    card: {
        padding: 14,
        paddingTop: 28,
    },
    header: {
        position: "absolute",
        top: -16,
        left: 12,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 32,
    },
    avatar: {
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Monda",
        fontSize: 16,
        fontWeight: "bold",
        color: "#1a1a1a",
        flexShrink: 0,
    },
    guestAvatar: {
        width: 32,
        height: 32,
        boxSizing: "border-box",
        border: "2px dashed #585858",
        backgroundColor: palette.mainColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Monda",
        fontSize: 18,
        fontWeight: "bold",
        color: "#585858",
        flexShrink: 0,
    },
    name: {
        fontFamily: "Monda",
        fontSize: 13,
        fontWeight: "bold",
        color: "#D4D4D4",
        backgroundColor: palette.mainColor,
        padding: "2px 8px",
        letterSpacing: 0.5,
        lineHeight: 1,
    },
    text: {
        fontFamily: "Roboto",
        fontSize: 13,
        lineHeight: 1.5,
        color: "#D4D4D4",
        display: "block",
    },
    loginPrompt: {
        fontFamily: "Roboto",
        fontSize: 12,
        color: palette.darkenedUninteractive,
        display: "block",
        marginBottom: 10,
    },
    loginRow: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },
    loginButton: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        backgroundColor: "#1E1E1F",
        fontFamily: "Monda",
        fontSize: 13,
        fontWeight: "bold",
        color: "#D4D4D4",
        letterSpacing: 0.5,
    },
    loginIcon: {
        width: 18,
        height: 18,
        flexShrink: 0,
    },
    composeArea: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },
    composeInput: {
        backgroundColor: "#1E1E1F",
        border: "none",
        outline: "none",
        resize: "vertical",
        minHeight: 72,
        padding: 10,
        fontFamily: "Roboto",
        fontSize: 13,
        lineHeight: 1.5,
        color: "#D4D4D4",
    },
    composeRow: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
    },
    composeButton: {
        padding: "8px 14px",
        backgroundColor: "#1E1E1F",
        fontFamily: "Monda",
        fontSize: 13,
        fontWeight: "bold",
        color: "#D4D4D4",
        letterSpacing: 0.5,
    },
});

const IncognitoIcon = () => (
    <svg className={css(chat.loginIcon)} viewBox="0 0 24 24" fill="#D4D4D4">
        <path
            d="M17.06 13C15.2 13 13.64 14.33 13.24 16.1C12.29 15.69 11.42 15.8 10.76 16.09C10.35 14.31 8.79 13 6.94 13C4.77 13 3 14.79 3 17C3 19.21 4.77 21 6.94 21C9 21 10.68 19.38 10.84 17.32C11.18 17.08 12.07 16.63 13.16 17.34C13.34 19.39 15 21 17.06 21C19.23 21 21 19.21 21 17C21 14.79 19.23 13 17.06 13M6.94 19.86C5.38 19.86 4.13 18.58 4.13 17S5.39 14.14 6.94 14.14C8.5 14.14 9.75 15.42 9.75 17S8.5 19.86 6.94 19.86M17.06 19.86C15.5 19.86 14.25 18.58 14.25 17S15.5 14.14 17.06 14.14C18.62 14.14 19.88 15.42 19.88 17S18.61 19.86 17.06 19.86M22 10.5H2V12H22V10.5M15.53 2.63C15.31 2.14 14.75 1.88 14.22 2.05L12 2.79L9.77 2.05L9.72 2.04C9.19 1.89 8.63 2.17 8.43 2.68L6 9H18L15.56 2.68L15.53 2.63Z" />
    </svg>
)

const GitHubIcon = () => (
    <svg className={css(chat.loginIcon)} viewBox="0 0 24 24" fill="#D4D4D4">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
);

const GoogleIcon = () => (
    <svg className={css(chat.loginIcon)} viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);

export interface AvatarSpec {
    color: string;
    initial: string;
}

export interface ChatMessage {
    avatar: AvatarSpec;
    name: string;
    text: string;
}

const Avatar: React.FC<AvatarSpec> = ({ color, initial }) => (
    <div className={css(chat.avatar)} style={{ backgroundColor: color }}>
        {initial}
    </div>
);

const MessageCard: React.FC<ChatMessage> = ({ avatar, name, text }) => (
    <div className={css(chat.cardWrap)}>
        <div className={css(globalStyles.substrate, chat.card)}>
            <span className={css(chat.text)}>{text}</span>
        </div>
        <div className={css(chat.header)}>
            <Avatar {...avatar} />
            <span className={css(chat.name)}>{name}</span>
        </div>
    </div>
);

interface ComposerIdentity {
    avatar: AvatarSpec;
    name: string;
}

const ComposeCard: React.FC<{ identity: ComposerIdentity }> = ({ identity }) => {
    const [text, setText] = useState("");
    return (
        <div className={css(chat.cardWrap)}>
            <div className={css(globalStyles.substrate, chat.card)}>
                <div className={css(chat.composeArea)}>
                    <textarea
                        className={css(chat.composeInput)}
                        placeholder="Write a message…"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <div className={css(chat.composeRow)}>
                        <div className={css(globalStyles.pressable, chat.composeButton)}>
                            <span>SEND</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className={css(chat.header)}>
                <Avatar {...identity.avatar} />
                <span className={css(chat.name)}>{identity.name}</span>
            </div>
        </div>
    );
};

const LoginCard = () => {
    const [identity, setIdentity] = useState<ComposerIdentity | null>(null);
    if (identity) return <ComposeCard identity={identity} />;
    return (
        <div className={css(chat.cardWrap)}>
            <div className={css(globalStyles.substrate, chat.card)}>
                <span className={css(chat.loginPrompt)}>
                    Sign in to leave a message
                </span>
                <div className={css(chat.loginRow)}>
                    <div
                        className={css(globalStyles.pressable, chat.loginButton)}
                        onClick={() => setIdentity({ avatar: { color: "#D4D4D4", initial: "O" }, name: "octocat" })}
                    >
                        <IncognitoIcon />
                        <span>STAY ANONYMOUS</span>
                    </div>
                    <div
                        className={css(globalStyles.pressable, chat.loginButton)}
                        onClick={() => setIdentity({ avatar: { color: "#D4D4D4", initial: "O" }, name: "octocat" })}
                    >
                        <GitHubIcon />
                        <span>CONTINUE WITH GITHUB</span>
                    </div>
                    <div
                        className={css(globalStyles.pressable, chat.loginButton)}
                        onClick={() => setIdentity({ avatar: { color: "#7AB8FF", initial: "G" }, name: "google-user" })}
                    >
                        <GoogleIcon />
                        <span>CONTINUE WITH GOOGLE</span>
                    </div>
                </div>
            </div>
            <div className={css(chat.header)}>
                <div className={css(chat.guestAvatar)}>?</div>
                <span className={css(chat.name)}>guest</span>
            </div>
        </div>
    );
};

export const Chat: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => (
    <>
        <div className={css(globalStyles.substrate, chat.titleCard)}>
            <span className={css(chat.title)}>CHAT</span>
            <span className={css(chat.count)}>[{messages.length}]</span>
        </div>
        <div className={css(chat.scroll)}>
            {messages.map((m, i) => <MessageCard key={i} {...m} />)}
            <LoginCard />
        </div>
    </>
);
