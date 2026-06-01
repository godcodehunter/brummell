import React from 'react';
import { ApolloClient, ApolloProvider, ApolloLink, InMemoryCache, Observable } from '@apollo/client';

// Storybook runs components in isolation, but several of them (SearchCard,
// TagSelector, profile/tags forms in the admin Editor, ...) wrap their data
// access in `useQuery`. That hook throws an invariant if no ApolloProvider
// sits above it, which crashes the whole story preview.
//
// We don't want stories to actually hit the network, so the client below is
// wired to an empty-response link: every request resolves immediately with
// `{}`, and the consumers' `data?.foo ?? []` fallbacks render an empty
// state. Stories that need representative data can override the decorator
// or pass MockedProvider via story-level decorators.
const emptyLink = new ApolloLink(() => new Observable<any>(observer => {
    observer.next({ data: {} });
    observer.complete();
}));

const stubClient = new ApolloClient({
    link: emptyLink,
    cache: new InMemoryCache(),
});

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
    decorators: [
        (Story: React.ComponentType) => (
            <ApolloProvider client={stubClient}>
                <Story />
            </ApolloProvider>
        ),
    ],
};

export default preview;
