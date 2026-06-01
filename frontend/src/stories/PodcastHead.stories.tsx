import '../index.css';
import { PodcastHead } from '../components/PodcastHead';
import { Tag } from '../components/Chip';
import chroma from 'chroma-js';

export default {
    title: 'PodcastHead',
    component: PodcastHead,
};

const tags: Tag[] = [
    {
        label: "some1",
        color: chroma("#7AB8FF"),
        tooltip: "tooltip1",
    },
    {
        label: "some2",
        color: chroma("#FFB87A"),
        tooltip: "tooltip2",
    },
    {
        label: "some3",
        color: chroma("#7AFFB8"),
        tooltip: "tooltip3",
    },
]

const guests = [
    { image: "https://thumbor.evrimagaci.org/7mzcf_bIAsc-LTWaXdLxJR1ENFU=/filters:quality(85)/old/mi_media/afcae823e61eefb077e1f223594b1e7f.jpeg", name: "ZL0_", whoIs: "Expert in distributed systems", color: "green" },
    { image: "https://upload.wikimedia.org/wikipedia/en/b/b9/Terminator-2-judgement-day.jpg", name: "Alpha17", whoIs: "Debugging expert", color: "red" }
];

const subtitles = [
    {
        speakerIdx: 0,
        words: [
            { range: { start: 0, end: 0.2 }, text: "some1 some2" },
            { range: { start: 0.4, end: 0.6 }, text: "some3" },
            { range: { start: 0.8, end: 1.2 }, text: "some4 some5" },
        ],
    },
    {
        speakerIdx: 1,
        words: [
            { range: { start: 1.3, end: 1.5 }, text: "some1 some2" },
            { range: { start: 1.6, end: 1.8 }, text: "some3" },
            { range: { start: 1.9, end: 2.1 }, text: "some4 some5" },
        ],
    },
    {
        speakerIdx: 0,
        words: [
            { range: { start: 0, end: 0.2 }, text: "some1 some2" },
            { range: { start: 0.4, end: 0.6 }, text: "some3" },
            { range: { start: 0.8, end: 1.2 }, text: "some4 some5" },
        ],
    },
    {
        speakerIdx: 1,
        words: [
            { range: { start: 1.3, end: 1.5 }, text: "some1 some2" },
            { range: { start: 1.6, end: 1.8 }, text: "some3" },
            { range: { start: 1.9, end: 2.1 }, text: "some4 some5" },
        ],
    },
];

export const Default = {
    args: {
        badge: "new",
        tags,
        path: "https://c5290dc3-d620-47d8-b36e-9a1e16c34745.mdnplay.dev/shared-assets/audio/t-rex-roar.mp3",
        title: "Title",
        description: "Shot description",
        guests,
        subtitles,
    },
};
