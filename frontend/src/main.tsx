import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import App from './App';

import {
  ApolloClient,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
  split,
} from "@apollo/client";
import { createClient } from "graphql-ws";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";

// setting configuration for http connect for Query and Mutation
const httpLink = new HttpLink({
  // backend link, check backend console for link
  uri: "http://localhost:4000/graphql", 
});

// setting configuration for websocket connect for subscription
const wsLink = new GraphQLWsLink(
  createClient({
    // backend link, check backend console for link
    url: "ws://localhost:4000/graphql",
  })
);

// The split function takes three parameters:
//
// * A function that's called for each operation to execute
// * The Link to use for an operation if the function returns a "truthy" value
// * The Link to use for an operation if the function returns a "falsy" value
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  // web socket connection for subscriptions
  wsLink, 
  // http connection for query and mutation
  httpLink 
);


// setting up apollo client with the server http and websocket links
const client = new ApolloClient({
  link: splitLink,
  // for in memory caching of data
  cache: new InMemoryCache(), 
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
     <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </StrictMode>,
)
