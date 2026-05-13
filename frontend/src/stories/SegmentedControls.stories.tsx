import { SegmentedControls } from '../components/SegmentedControls';

export default {
    title: 'SegmentedControls',
    component: SegmentedControls,
};

export const AllSelected = {
    args: {
        variants: [
            { label: "Posts", isActive: true, value: "Posts" },
            { label: "Tweets", isActive: true, value: "Tweets" },
            { label: "Talks", isActive: true, value: "Talks" },
        ],
    },
};
