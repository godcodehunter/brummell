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
import { schema, type Context } from "./graphql/schema.js";
import { isValidToken } from "./admin_pass.js"

import { initDatabase } from "./db/seed.js";
import { config } from "./config.js";


initDatabase();

// Pull a "Bearer <token>" out of the Authorization header. Lower-cases
// the prefix check so clients that send "bearer ..." also work.
function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const m = /^Bearer\s+(.+)$/i.exec(headerValue);
  return m ? m[1]!.trim() : null;
}

// Yoga is a self-contained GraphQL HTTP handler. It implements the GraphQL
// over HTTP spec, including CORS handling and the GraphiQL playground UI
// you see when you open the endpoint in a browser.
const yoga = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
  cors: { origin: "*", credentials: true },
  // Built once per request. Resolvers receive this object as the third
  // arg. We resolve `isAuthorized` here so individual resolvers can stay
  // a simple `ctx.isAuthorized` check.
  //
  // Note: this factory runs for both HTTP and WebSocket operations. For
  // HTTP, `request` is a real Fetch `Request` with `headers.get`. For WS
  // subscriptions the envelope may pass a different (or no) request, so
  // we defensively bail to unauthenticated rather than crashing — without
  // this guard the whole subscription connection dies with code 4500.
  context: ({ request }): Context => {
    const authHeader =
      typeof request?.headers?.get === "function"
        ? request.headers.get("authorization")
        : null;
    const token = extractBearerToken(authHeader);
    return {
      token,
      isAuthorized: token !== null && isValidToken(token),
    };
  },
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
  console.log(`🚀 GraphQL ready at http://${config.publicUrl}:${config.port}/graphql`);
  console.log(`🚀 Subscriptions at ws://${config.publicUrl}:${config.port}/graphql`);
});
