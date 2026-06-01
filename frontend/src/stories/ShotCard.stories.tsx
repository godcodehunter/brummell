import '../index.css';
import { ShotCard } from '../components/ShotCard';
import { Tag } from '../components/Chip';
import chroma from 'chroma-js';
import { DateTime } from 'luxon';

export default {
    title: 'ShotCard',
    component: ShotCard,
};

const tags: Tag[] = [
    { label: "rust",        color: chroma("#7AB8FF"), tooltip: "Rust" },
    { label: "concurrency", color: chroma("#FF7A8A"), tooltip: "Concurrency" },
];

export const Short = {
    args: {
        text: "If you can't reproduce the race in a unit test, it's a feature, not a bug.",
        tags,
        created_at: DateTime.fromISO("2026-04-12T10:00:00"),
        style: { width: 320 },
    },
};

export const Multiline = {
    args: {
        text:
            "Spent four hours on a flaky test today.\n\nTurns out the order of two `for ... of` loops mattered because the iterator was being consumed twice.\nLesson: print the diff, not the assertion.",
        tags: [tags[1]],
        created_at: DateTime.fromISO("2026-04-08T18:30:00"),
        style: { width: 320 },
    },
};

export const NoTags = {
    args: {
        text: "Cassette tapes were a sign of culture, podcasts are a continuation.",
        tags: [],
        created_at: DateTime.fromISO("2026-03-22T09:00:00"),
        style: { width: 320 },
    },
};
