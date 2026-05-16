import { useNavigate } from 'react-router-dom';
import { globalStyles } from '../globalStyles';
import { StyleSheet, css } from 'aphrodite';
import { ReactComponent as Arrow } from '../resource/back.svg';

const styles = StyleSheet.create({
    backButton: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        padding: 12,
        userSelect: "none",
        fontFamily: "Roboto",
        fontSize: 14,
        color: "#D4D4D4",
    },
    backArrow: {
        width: 12,
        height: 12,
        flexShrink: 0,
    },
    headline: {
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: "bold",
        fontSize: "12px",
        lineHeight: 1,
        color: "#D4D4D4",
    },
})

const BackToMain = () => {
    const navigate = useNavigate();
    return (
        <div
            className={css(globalStyles.substrate, globalStyles.pressable, styles.backButton)}
            onClick={() => navigate("/")}
        >
            <Arrow className={css(styles.backArrow)} />
            <span className={css(styles.headline)}>
                BACK TO MAIN
            </span>
        </div>
    );
};

export default BackToMain;