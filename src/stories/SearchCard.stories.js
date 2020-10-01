import React from 'react';
import {SearchCard} from '../components/SearchCard';

export default {
    component: SearchCard,
    title: 'SearchCard',
};

const Template = args => <SearchCard {...args} />;

export const Default = Template.bind({});
