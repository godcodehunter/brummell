import { useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { StyleSheet, css } from "aphrodite";
import { globalStyles, palette } from "./global_styles";

const GET_OWNER = gql`
    query GetOwner {
        getOwner {
            id
        }
    }
`;

const SIGN_IN = gql`
    mutation SignIn($password: String!) {
        signIn(password: $password) {
            token
        }
    }
`;

const SETUP_OWNER = gql`
    mutation SetupOwner($password: String!) {
        setupOwner(password: $password) {
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
    hint: {
        fontFamily: "Roboto",
        fontSize: 12,
        color: palette.darkenedUninteractive,
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

interface PasswordFieldProps {
    value: string;
    autoComplete: "current-password" | "new-password";
    onChange: (v: string) => void;
    onEnter: () => void;
}

const PasswordField = ({ value, autoComplete, onChange, onEnter }: PasswordFieldProps) => {
    const [focused, setFocused] = useState(false);
    return (
        <div
            className={css(styles.field, focused ? styles.fieldFocused : styles.fieldUnfocused)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
        >
            <input
                type="password"
                autoComplete={autoComplete}
                className={css(styles.input)}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }}
            />
        </div>
    );
};

interface SubmitButtonProps {
    label: string;
    enabled: boolean;
    loading: boolean;
    onClick: () => void;
}

const SubmitButton = ({ label, enabled, loading, onClick }: SubmitButtonProps) => (
    <div className={css(styles.row)}>
        <div
            className={css(
                globalStyles.pressable,
                styles.button,
                !enabled && styles.buttonDisabled,
            )}
            onClick={enabled ? onClick : undefined}
        >
            <span>{loading ? "…" : label}</span>
        </div>
    </div>
);

const Fonts = () => (
    <>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
    </>
);

interface AuthCardProps {
    onAuthorized: (token: string) => void;
}

const SignInCard = ({ onAuthorized }: AuthCardProps) => {
    const [password, setPassword] = useState("");
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
            <Fonts />
            <div className={css(globalStyles.substrate, styles.card)}>
                <span className={css(styles.headline)}>PASSWORD</span>
                <PasswordField
                    value={password}
                    autoComplete="current-password"
                    onChange={setPassword}
                    onEnter={submit}
                />
                {error && <span className={css(styles.error)}>{error.message}</span>}
                <SubmitButton label="SUBMIT" enabled={canSubmit} loading={loading} onClick={submit} />
            </div>
        </div>
    );
};

const SetupCard = ({ onAuthorized }: AuthCardProps) => {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [setupOwner, { loading, error }] = useMutation<{ setupOwner: { token: string } }>(SETUP_OWNER);

    const mismatch = confirm.length > 0 && password !== confirm;
    const canSubmit = password.length > 0 && password === confirm && !loading;

    const submit = async () => {
        if (!canSubmit) return;
        const res = await setupOwner({
            variables: { password },
            refetchQueries: [{ query: GET_OWNER }],
        });
        const token = res.data?.setupOwner.token;
        if (token) onAuthorized(token);
    };

    return (
        <div className={css(styles.cardWrap)}>
            <Fonts />
            <div className={css(globalStyles.substrate, styles.card)}>
                <span className={css(styles.headline)}>SET PASSWORD</span>
                <span className={css(styles.hint)}>
                    No owner yet — choose a password to create one.
                </span>
                <PasswordField
                    value={password}
                    autoComplete="new-password"
                    onChange={setPassword}
                    onEnter={submit}
                />
                <span className={css(styles.headline)}>CONFIRM PASSWORD</span>
                <PasswordField
                    value={confirm}
                    autoComplete="new-password"
                    onChange={setConfirm}
                    onEnter={submit}
                />
                {mismatch && <span className={css(styles.error)}>Passwords do not match</span>}
                {error && <span className={css(styles.error)}>{error.message}</span>}
                <SubmitButton label="CREATE" enabled={canSubmit} loading={loading} onClick={submit} />
            </div>
        </div>
    );
};

export const AdminPanel = () => {
    const [token, setToken] = useState<string | null>(null);
    const { data, loading } = useQuery<{ getOwner: { id: string } | null }>(GET_OWNER);

    if (loading) return null;
    if (!token) {
        return data?.getOwner
            ? <SignInCard onAuthorized={setToken} />
            : <SetupCard onAuthorized={setToken} />;
    }
    return (
        <div style={{ color: palette.fontColor }}>
            {/* TODO: admin content */}
        </div>
    );
};
