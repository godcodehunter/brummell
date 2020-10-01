import React from 'react';
import { TimelineCard, NodeTag } from '../components/TimelineCard';

export default {
    component: TimelineCard,
    title: 'TimelineCard',
};

const Template = args => <TimelineCard {...args} />;

export const NoData = Template.bind({});
NoData.args = {
    data: [],
    style: {width: 300},
};


export const Filled = Template.bind({});
Filled.args = {
    data: [
        {tag: NodeTag.Category, label: "item-1", children: [
            {tag: NodeTag.Item, label: "item--1-1"},
            {tag: NodeTag.Item, label: "item--1-2"},
            {tag: NodeTag.Item, label: "item--1-3"},
        ]},
        {tag: NodeTag.Category, label: "item-2", children: [
            {tag: NodeTag.Item, label: "item-2-1"},
            {tag: NodeTag.Item, label: "item-2-2"},
            {tag: NodeTag.Category, label: "item-2-3", children: [
                {tag: NodeTag.Item, label: "item-2-3-1"},
                {tag: NodeTag.Item, label: "item-2-3-2"},
            ]},
            {tag: NodeTag.Item, label: "item-2-4"},
            {tag: NodeTag.Item, label: "item-2-5"},
        ]},
        {tag: NodeTag.Category, label:"item-3", children: [
            {tag: NodeTag.Item, label: "item-3-1"},
            {tag: NodeTag.Item, label: "item-3-2"},
            {tag: NodeTag.Item, label: "item-3-3"},
        ]},
    ],
    style: {width: 300},
};

