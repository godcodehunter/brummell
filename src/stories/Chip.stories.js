import React from 'react';
import Chip from '../components/Chip';

export default {
  component: Chip,
  title: 'Chip',
};

const Template = args => <Chip {...args} />;

export const Default = Template.bind({});
Default.args = {
  label: "Label",
  removable: true,
};

