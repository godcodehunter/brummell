import React from 'react';
import { SegmentedControls } from '../components/SegmentedControls';

export default {
  component: SegmentedControls,
  title: 'SegmentedControls',
};

const Template = args => <SegmentedControls {...args} />;

export const AllSelected = Template.bind({});
AllSelected.args = {
  variants: [
    {label: "Posts", isActive: true, value: "Posts"}, 
    {label: "Tweets", isActive: true, value: "Tweets"}, 
    {label: "Talks", isActive: true, value: "Talks"},
  ]
};

