import { useEffect, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { StyleSheet, css } from "aphrodite";
import { globalStyles, palette } from "./globalStyles";
import { ArticleCreator } from "./components/ArticleCreator";
import { ErrorMsg } from "./components/ErrorMsg";

const TOKEN_STORAGE_KEY = "authToken";

const GET_OWNER = gql`
    query GetOwner {
        getOwner {
            id
        }
    }
`;

const VALIDATE_TOKEN = gql`
    query ValidateToken {
        validateToken
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
    authBackdrop: {
        minHeight: "100vh",
        width: "100%",
        backgroundColor: palette.mainColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
    },
    cardWrap: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 360,
        maxWidth: "100%",
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
                {error && <ErrorMsg title={error.name} text={error.message}/>}
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
                {mismatch && <ErrorMsg title="Validation" text="Passwords do not match"/>}
                {error && <ErrorMsg title={error.name} text={error.message}/>}
                <SubmitButton label="CREATE" enabled={canSubmit} loading={loading} onClick={submit} />
            </div>
        </div>
    );
};

export const AdminPanel = () => {
    // Hydrate from localStorage so a reload doesn't drop the user back to
    // the password form. The token is still verified against the server
    // below (it can be stale if the server restarted and lost its session
    // set, or tampered with from devtools).
    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem(TOKEN_STORAGE_KEY),
    );

    const { data: ownerData, loading: ownerLoading } = useQuery<{
        getOwner: { id: string } | null;
    }>(GET_OWNER);

    const { data: validateData, loading: validateLoading } = useQuery<{
        validateToken: boolean;
    }>(VALIDATE_TOKEN, {
        skip: !token,
        // Don't trust the cache here — the question "is this token still
        // good" must hit the server on every mount.
        fetchPolicy: "network-only",
    });

    // Server says the persisted token isn't live anymore — drop it.
    useEffect(() => {
        if (token && validateData && validateData.validateToken === false) {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            setToken(null);
        }
    }, [token, validateData]);

    const handleAuthorized = (newToken: string) => {
        localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
        setToken(newToken);
    };

    if (ownerLoading) return null;
    if (token && validateLoading) return null;

    const authorized = token && validateData?.validateToken === true;

    if (!authorized) {
        return (
            <div className={css(styles.authBackdrop)}>
                {ownerData?.getOwner
                    ? <SignInCard onAuthorized={handleAuthorized} />
                    : <SetupCard onAuthorized={handleAuthorized} />}
            </div>
        );
    }

    return (
        <div style={{ color: palette.fontColor }}>
            <ArticleCreator />
        </div>
    );
};
