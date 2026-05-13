import type { Meta, StoryObj } from '@storybook/react';
import { Chat, ChatMessage } from '../components/Chat';
import { constants } from '../globalStyles';

const chatStub: ChatMessage[] = [
    {
        avatar: { color: "#7AB8FF", initial: "L" },
        name: "linus",
        text: "Concurrency model looks suspect — what guarantees ordering across the barriers here?",
    },
    {
        avatar: { color: "#FFB87A", initial: "A" },
        name: "ada",
        text: "Agree on the ordering question. The acquire/release pair downstream should cover it, but I'd want a written invariant.",
    },
    {
        avatar: { color: "#B87AFF", initial: "G" },
        name: "grace",
        text: "Why not a lock-free queue? You'd avoid this whole class of issue.",
    },
    {
        avatar: { color: "#7AFFB8", initial: "D" },
        name: "dijkstra",
        text: "Premature. Establish correctness first, performance second.",
    },
    {
        avatar: { color: "#7AB8FF", initial: "L" },
        name: "linus",
        text: "Concurrency model looks suspect — what guarantees ordering across the barriers here?",
    },
    {
        avatar: { color: "#FFB87A", initial: "A" },
        name: "ada",
        text: "Agree on the ordering question. The acquire/release pair downstream should cover it, but I'd want a written invariant.",
    },
    {
        avatar: { color: "#B87AFF", initial: "G" },
        name: "grace",
        text: "Why not a lock-free queue? You'd avoid this whole class of issue.",
    },
    {
        avatar: { color: "#7AFFB8", initial: "D" },
        name: "dijkstra",
        text: "Premature. Establish correctness first, performance second.",
    },
];

const meta: Meta<typeof Chat> = {
    title: 'Chat',
    component: Chat,
    decorators: [
        (Story: any) => (
            <div
                style={{
                    width: 340,
                    height: '100vh',
                    paddingTop: constants.gap,
                    paddingRight: constants.gap,
                    paddingBottom: constants.gap, 
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
                <Story />
            </div>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof Chat>;

export const Default: Story = {
    args: {
        messages: chatStub,
    },
};

export const Empty: Story = {
    args: {
        messages: [],
    },
};

export const SingleMessage: Story = {
    args: {
        messages: [chatStub[0]],
    },
};
