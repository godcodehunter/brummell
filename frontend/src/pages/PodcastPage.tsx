import { StyleSheet, css } from 'aphrodite';
import { palette, constants } from '../globalStyles';
import { Chat } from '../components/Chat';
import { PodcastCard } from '../components/PodcastCard';
import BackToMain from '../components/BackToMain';
import { Category, Item, Node, NodeTag, TreeCard } from '../components/TreeCard';

const page = StyleSheet.create({
    root: {
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
        backgroundColor: palette.mainColor,
        boxSizing: "border-box",
    },
    leftPanel: {
        flex: "0 0 300px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        paddingTop: constants.gap,
        paddingLeft: constants.gap,
        paddingBottom: constants.gap,
        gap: constants.gap,
        boxSizing: "border-box",
        minHeight: 0,
        overflow: "hidden",
    },
    middlePanel: {
        flex: "1 1 0",
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        paddingTop: constants.gap,
        paddingLeft: constants.gap,
        paddingRight: constants.gap,
        paddingBottom: constants.gap,
        display: "flex",
        flexDirection: "column",
        gap: constants.gap,
        boxSizing: "border-box",
        minWidth: 0,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "::-webkit-scrollbar": {
            display: "none",
        },
    },
    rightPanel: {
        flex: "0 0 340px",
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        paddingTop: constants.gap,
        paddingRight: constants.gap,
        paddingBottom: constants.gap,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
    },
    // Left-side content slot under BackToMain. Replace the inner placeholder
    // with the real content component once the logic is wired up.
    leftContent: {
        flex: "1 1 0",
        minHeight: 0,
        overflow: "hidden",
    },
});

export const PodcastPage = () => {
    return (
        <div className={css(page.root)}>
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />

            <div className={css(page.leftPanel)}>
                <BackToMain />
                <div className={css(page.leftContent)}>
                    <TreeCard
                        title={"CONTENTS"}
                        data={[]}
                        // activeId={activeId}
                        // expandIds={visibleIds}
                        // onNodeClick={(node) => {
                        //     const scroller = middlePanelRef.current;
                        //     const target = scroller?.querySelector(`#${CSS.escape(node.id)}`) as HTMLElement | null;
                        //     if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
                        // }}
                    />
                </div>
            </div>

            <div className={css(page.middlePanel)}>
                <PodcastCard />
            </div>
            <div className={css(page.rightPanel)}>
                <Chat messages={[]} />
            </div>
        </div>
    );
};
