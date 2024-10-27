import React from 'react';
import { Chip } from '../components/Chip';

export default {
  component: Chip,
  title: 'Chip',
};

const Template = args => <Chip {...args} />;

export const Removable = Template.bind({});
Removable.args = {
  label: "Label",
  removable: true,
};

export const Badge = Template.bind({});
Badge.args = {
  label: "Label",
  removable: false,
};


