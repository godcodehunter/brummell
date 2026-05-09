import { useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { StyleSheet, css } from "aphrodite";
import { globalStyles, palette } from "./global_styles";

const SIGN_IN = gql`
    mutation SignIn($password: String!) {
        signIn(password: $password) {
            token
        }
    }
`;

const styles = StyleSheet.create({
    cardWrap: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 360,
    },
    card: {
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
    },
    headline: {
        fontFamily: "Roboto",
        fontWeight: "bold",
        fontSize: 12,
        lineHeight: "26px",
        color: "#D4D4D4",
    },
    field: {
        display: "flex",
        backgroundColor: "#3F3D3D",
        height: 25,
        boxSizing: "border-box",
    },
    fieldFocused: {
        border: "0.4px solid #ABABAB",
    },
    fieldUnfocused: {
        padding: 0.4,
    },
    input: {
        flexGrow: 1,
        backgroundColor: "rgba(0,0,0,0)",
        border: "none",
        paddingLeft: 5,
        fontFamily: "Roboto",
        fontSize: 13,
        color: "#D4D4D4",
        ":hover": { outline: "none" },
        ":focus": { outline: "none" },
    },
    row: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
    },
    button: {
        padding: "8px 14px",
        backgroundColor: "#1E1E1F",
        fontFamily: "Monda",
        fontSize: 13,
        fontWeight: "bold",
        color: "#D4D4D4",
        letterSpacing: 0.5,
    },
    buttonDisabled: {
        opacity: 0.5,
        cursor: "default",
    },
    error: {
        fontFamily: "Roboto",
        fontSize: 12,
        color: "#E06C6C",
    },
});

interface AuthorizationFormProps {
    onAuthorized: (token: string) => void;
}

const AuthorizationForm = ({ onAuthorized }: AuthorizationFormProps) => {
    const [password, setPassword] = useState("");
    const [focused, setFocused] = useState(false);
    const [signIn, { loading, error }] = useMutation<{ signIn: { token: string } }>(SIGN_IN);

    const submit = async () => {
        if (!password || loading) return;
        const res = await signIn({ variables: { password } });
        const token = res.data?.signIn.token;
        if (token) onAuthorized(token);
    };

    const canSubmit = password.length > 0 && !loading;

    return (
        <div className={css(styles.cardWrap)}>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <div className={css(globalStyles.substrate, styles.card)}>
                <span className={css(styles.headline)}>PASSWORD</span>
                <div
                    className={css(styles.field, focused ? styles.fieldFocused : styles.fieldUnfocused)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                >
                    <input
                        type="password"
                        autoComplete="current-password"
                        className={css(styles.input)}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                    />
                </div>
                {error && <span className={css(styles.error)}>{error.message}</span>}
                <div className={css(styles.row)}>
                    <div
                        className={css(
                            globalStyles.pressable,
                            styles.button,
                            !canSubmit && styles.buttonDisabled,
                        )}
                        onClick={canSubmit ? submit : undefined}
                    >
                        <span>{loading ? "…" : "SUBMIT"}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdminPanel = () => {
    const [token, setToken] = useState<string | null>(null);
    if (!token) return <AuthorizationForm onAuthorized={setToken} />;
    return (
        <div style={{ color: palette.fontColor }}>
            {/* TODO: admin content */}
        </div>
    );
};
