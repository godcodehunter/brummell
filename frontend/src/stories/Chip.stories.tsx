import { Chip } from '../components/Chip';

export default {
    title: 'Chip',
    component: Chip,
};

export const Removable = {
    args: {
        label: "Label",
        removable: true,
    },
};

export const Badge = {
    args: {
        label: "Label",
        removable: false,
    },
};
