/** @type { import('@storybook/react').Preview } */
const preview = {
    parameters: {
        actions: { argTypesRegex: '^on[A-Z].*' },
        backgrounds: {
            default: 'app',
            values: [
                { name: 'app', value: '#212121' },
                { name: 'light', value: '#ffffff' },
            ],
        },
    },
};

export default preview;
