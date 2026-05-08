// Entry point. Wires up:
//   - graphql-yoga       — handles HTTP GraphQL queries/mutations + CORS.
//   - graphql-ws + ws    — handles GraphQL subscriptions over WebSocket.
//   - Our schema and DB  — imported from the modules below.
//
// One Node HTTP server hosts both protocols on the same port: HTTP traffic
// goes to Yoga, WebSocket upgrade requests go to graphql-ws.

import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { useServer } from "graphql-ws/lib/use/ws";
import { WebSocketServer } from "ws";
import { schema } from "./graphql/schema.js";
import { initDatabase } from "./db/seed.js";
import { config } from "./config.js";

// Bring up tables and seed demo data (no-op if the DB is already populated).
initDatabase();

// Yoga is a self-contained GraphQL HTTP handler. It implements the GraphQL
// over HTTP spec, including CORS handling and the GraphiQL playground UI
// you see when you open the endpoint in a browser.
const yoga = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
  cors: { origin: "*", credentials: true },
});

// Plain Node HTTP server. Yoga is the request handler.
const httpServer = createServer(yoga);

// WebSocketServer attaches to the same HTTP server and only handles the
// upgrade requests on the GraphQL path.
const wsServer = new WebSocketServer({
  server: httpServer,
  path: yoga.graphqlEndpoint,
});

// Glue between graphql-ws (the protocol) and Yoga (which owns the schema
// and the `execute`/`subscribe` functions). This is the recommended
// integration pattern from the Yoga docs — it lets WS subscriptions go
// through the exact same plugin pipeline as HTTP requests.
useServer(
  {
    execute: (args: any) => (args as any).rootValue.execute(args),
    subscribe: (args: any) => (args as any).rootValue.subscribe(args),
    onSubscribe: async (ctx, msg) => {
      const { schema, execute, subscribe, contextFactory, parse, validate } =
        yoga.getEnveloped({
          ...ctx,
          req: (ctx.extra as any).request,
          socket: (ctx.extra as any).socket,
          params: msg.payload,
        });

      const args = {
        schema,
        operationName: msg.payload.operationName,
        document: parse(msg.payload.query),
        variableValues: msg.payload.variables,
        contextValue: await contextFactory(),
        rootValue: { execute, subscribe },
      };

      // Validate the query against our schema. If validation fails we
      // return the errors instead of running the operation.
      const errors = validate(args.schema, args.document);
      if (errors.length) return errors;
      return args;
    },
  },
  wsServer,
);

httpServer.listen(config.port, () => {
  console.log(`📁 DB directory: ${config.dbDir}`);
  console.log(`🚀 GraphQL ready at http://localhost:${config.port}/graphql`);
  console.log(`🚀 Subscriptions at ws://localhost:${config.port}/graphql`);
});
