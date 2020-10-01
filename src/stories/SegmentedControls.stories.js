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
    {label: "Posts", isActive: true}, 
    {label: "Tweets", isActive: true}, 
    {label: "Talks", isActive: true},
  ]
};

