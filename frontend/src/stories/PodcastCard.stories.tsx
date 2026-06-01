import '../index.css';
import { PodcastCard } from '../components/PodcastCard';
import { Tag } from '../components/Chip';
import chroma from 'chroma-js';
import { DateTime } from 'luxon';

export default {
    title: 'PodcastCard',
    component: PodcastCard,
};

const tags: Tag[] = [
    { label: "rust",    color: chroma("#7AB8FF"), tooltip: "Rust" },
    { label: "systems", color: chroma("#FFB87A"), tooltip: "Systems programming" },
    { label: "audio",   color: chroma("#7AFFB8"), tooltip: "Audio engineering" },
];

export const Default = {
    args: {
        headline: "Async runtimes deep dive",
        tags,
        created_at: DateTime.fromISO("2026-04-12T10:00:00"),
        onOpen: () => console.log("open podcast"),
        style: { width: 300 },
    },
};

export const NoTags = {
    args: {
        headline: "First episode",
        tags: [],
        created_at: DateTime.fromISO("2026-01-08T10:00:00"),
        onOpen: () => console.log("open podcast"),
        style: { width: 300 },
    },
};

export const LongHeadline = {
    args: {
        headline: "Tracing concurrency bugs that only surface on big iron",
        tags,
        created_at: DateTime.fromISO("2026-03-20T10:00:00"),
        onOpen: () => console.log("open podcast"),
        style: { width: 300 },
    },
};
