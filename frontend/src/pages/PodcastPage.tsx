import { StyleSheet, css } from 'aphrodite';
import { palette, constants } from '../globalStyles';
import { Chat } from '../components/Chat';
import { PodcastCard, Range } from '../components/PodcastCard';
import BackToMain from '../components/BackToMain';
import { Category, NodeTag, TreeCard } from '../components/TreeCard';
import { gql, useQuery } from '@apollo/client';
import { useSearchParams, Navigate } from 'react-router-dom';

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

const GET_PODCAST = gql`
  query GetPodcast($id: Int!) {
    getPodcast(id: $id) {
      ribbon
      headline
      path
      createdAt
      guests {
        image
        name
        whoIs
      }
      topics {
        range {
          start
          end
        }
        title
      }
      subtitles {
        speakerIdx
        words {
          range {
            start
            end
          }
          text
        }
      }
      tags {
        id
        label
        color
        tooltip
      }
    }
  }
`;

export interface Topic {
    range: Range,
    text: string,
}

export const PodcastPage = () => {
    const [searchParams] = useSearchParams();
    const id = Number(searchParams.get("id"));

    const hasValidId = Number.isInteger(id) && id > 0;

    const { data, loading, error } = useQuery(GET_PODCAST, {
        variables: { id },
        skip: !hasValidId,
    });

    // Still fetching — don't redirect prematurely.
    if (hasValidId && loading) {
        return null;
    }

    // Invalid id, request failed, or no podcast with this id.
    if (!hasValidId || error || !data?.getPodcast) {
        return <Navigate to="/error" replace />;
    }

    function topicToTreeData(topics: Topic[]): Category[] {
        return topics.map((item) => ({
            tag: NodeTag.Category,
            id: String(item.range),
            label: item.text,
            children: [],
        }));
    }

    const podcast = data.getPodcast;

    return (
        <div className={css(page.root)}>
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />

            <div className={css(page.leftPanel)}>
                <BackToMain />
                <div className={css(page.leftContent)}>
                    <TreeCard
                        title={"CONTENTS"}
                        data={topicToTreeData(podcast.topics)}
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
                <PodcastCard
                    badge={podcast.ribbon}
                    tags={podcast.tags}
                    title={podcast.headline}
                    path={podcast.path}
                    description={podcast.description}
                    guests={podcast.guests}
                    subtitles={podcast.subtitles}
                />
            </div>
            <div className={css(page.rightPanel)}>
                <Chat messages={[]} />
            </div>
        </div>
    );
};
