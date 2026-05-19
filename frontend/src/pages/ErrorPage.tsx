import { StyleSheet, css } from 'aphrodite';
import { palette, constants } from '../globalStyles';
import BackToMain from '../components/BackToMain';

const page = StyleSheet.create({
    root: {
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: constants.gap,
        backgroundColor: palette.mainColor,
        boxSizing: "border-box",
    },
    title: {
        fontFamily: "Monda, sans-serif",
        fontSize: 48,
        fontWeight: 800,
        color: palette.fontColor,
        margin: 0,
    },
    subtitle: {
        fontFamily: "Roboto, sans-serif",
        fontSize: 18,
        color: palette.fontColor,
        opacity: 0.7,
        margin: 0,
    },
});

export const ErrorPage = () => {
    return (
        <div className={css(page.root)}>
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />

            <h1 className={css(page.title)}>Something went wrong</h1>
            <p className={css(page.subtitle)}>The content you are looking for was not found.</p>
            <BackToMain />
        </div>
    );
};
