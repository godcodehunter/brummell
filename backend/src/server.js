const { ApolloServer } = require("@apollo/server");
const { createServer } = require("http");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { expressMiddleware } = require("@apollo/server/express4");
const bodyParser = require("body-parser");
const express = require("express");
const cors = require("cors");
const {
  ApolloServerPluginDrainHttpServer,
} = require("@apollo/server/plugin/drainHttpServer");

const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const { PubSub } = require("graphql-subscriptions");

//define port for the graphql Server
const port = 4000;

// storing blogs in local
const blogs = [
    {
        headline: "January Yepp",
        illustration: "test",
        tags: [{
            label: "Test",
            color: "#327878",
            tooltip: "Test tooltip",
        }],
        preview_txt: "In November 2011, Amazon added what it called “Time To Read” to its new Kindle Touch, but disabled it by default. With the release of Kindle Paperwhite in October 2012, it enabled Time To Read and started advertising the feature. It was so popular that people with older versions of Kindle tried to figure out how to get it.",
        reading_time_min: 9,
        publication_time: 1706416211,
    },
    {
        headline: "February Oyy",
        illustration: "test",
        tags: [],
        preview_txt: "Test txt",
        reading_time_min: 9,
        publication_time: 1709094611,
    },
    {
        headline: "January Yepp",
        illustration: "test",
        tags: [{
            label: "Test",
            color: "#327878",
            tooltip: "Test tooltip",
        }],
        preview_txt: "In November 2011, Amazon added what it called “Time To Read” to its new Kindle Touch, but disabled it by default. With the release of Kindle Paperwhite in October 2012, it enabled Time To Read and started advertising the feature. It was so popular that people with older versions of Kindle tried to figure out how to get it.",
        reading_time_min: 9,
        publication_time: 1706416211,
    },
    {
        headline: "February Oyy",
        illustration: "test",
        tags: [],
        preview_txt: "Test txt",
        reading_time_min: 9,
        publication_time: 1709094611,
    },
    {
        headline: "January Yepp",
        illustration: "test",
        tags: [{
            label: "Test",
            color: "#327878",
            tooltip: "Test tooltip",
        }],
        preview_txt: "In November 2011, Amazon added what it called “Time To Read” to its new Kindle Touch, but disabled it by default. With the release of Kindle Paperwhite in October 2012, it enabled Time To Read and started advertising the feature. It was so popular that people with older versions of Kindle tried to figure out how to get it.",
        reading_time_min: 9,
        publication_time: 1706416211,
    },
    {
        headline: "February Oyy",
        illustration: "test",
        tags: [],
        preview_txt: "Test txt",
        reading_time_min: 9,
        publication_time: 1709094611,
    },
    {
        headline: "January Yepp",
        illustration: "test",
        tags: [{
            label: "Test",
            color: "#327878",
            tooltip: "Test tooltip",
        }],
        preview_txt: "In November 2011, Amazon added what it called “Time To Read” to its new Kindle Touch, but disabled it by default. With the release of Kindle Paperwhite in October 2012, it enabled Time To Read and started advertising the feature. It was so popular that people with older versions of Kindle tried to figure out how to get it.",
        reading_time_min: 9,
        publication_time: 1706416211,
    },
    {
        headline: "February Oyy",
        illustration: "test",
        tags: [],
        preview_txt: "Test txt",
        reading_time_min: 9,
        publication_time: 1709094611,
    },
    {
        headline: "January Yepp",
        illustration: "test",
        tags: [{
            label: "Test",
            color: "#327878",
            tooltip: "Test tooltip",
        }],
        preview_txt: "In November 2011, Amazon added what it called “Time To Read” to its new Kindle Touch, but disabled it by default. With the release of Kindle Paperwhite in October 2012, it enabled Time To Read and started advertising the feature. It was so popular that people with older versions of Kindle tried to figure out how to get it.",
        reading_time_min: 9,
        publication_time: 1706416211,
    },
    {
        headline: "February Oyy",
        illustration: "test",
        tags: [],
        preview_txt: "Test txt",
        reading_time_min: 9,
        publication_time: 1709094611,
    },
    {
        headline: "January Yepp",
        illustration: "test",
        tags: [{
            label: "Test",
            color: "#327878",
            tooltip: "Test tooltip",
        }],
        preview_txt: "In November 2011, Amazon added what it called “Time To Read” to its new Kindle Touch, but disabled it by default. With the release of Kindle Paperwhite in October 2012, it enabled Time To Read and started advertising the feature. It was so popular that people with older versions of Kindle tried to figure out how to get it.",
        reading_time_min: 9,
        publication_time: 1706416211,
    },
    {
        headline: "February Oyy",
        illustration: "test",
        tags: [],
        preview_txt: "Test txt",
        reading_time_min: 9,
        publication_time: 1709094611,
    },
    {
        headline: "January Yepp",
        illustration: "test",
        tags: [{
            label: "Test",
            color: "#327878",
            tooltip: "Test tooltip",
        }],
        preview_txt: "In November 2011, Amazon added what it called “Time To Read” to its new Kindle Touch, but disabled it by default. With the release of Kindle Paperwhite in October 2012, it enabled Time To Read and started advertising the feature. It was so popular that people with older versions of Kindle tried to figure out how to get it.",
        reading_time_min: 9,
        publication_time: 1706416211,
    },
    {
        headline: "February Oyy",
        illustration: "test",
        tags: [],
        preview_txt: "Test txt",
        reading_time_min: 9,
        publication_time: 1709094611,
    },
];

const tags = [
  {
    label: "banana",
    color: "#327878",
    tooltip: "Test tooltip",
  },
  {
    label: "ball",
    color: "#327878",
    tooltip: "Test tooltip",
  },
  {
    label: "beicon",
    color: "#327878",
    tooltip: "Test tooltip",
  }
];

// event that the frontend will subscribe to
const blogs_created = "NEW_BLOG_CREATED";

// setting up publish/subscriber
const pubSub = new PubSub();

/**
 * Function to push new blog event
 * @param {*} content , content of the blog
 * @param {*} author , author of the bog
 * @param {*} id , id of the blog
 */
const publishNewBlogAdded = (content, author, id) => {
  pubSub.publish(blogs_created, {
    newBlog: { content, author, id },
  });
};

// schema defination for our grapql server
const typeDefs = `
    type Tag {
        label: String!,
        color: String!,
        tooltip: String!,
    }

    type Article {
        id: ID!
        headline: String!
        illustration: String!
        tags: [Tag]!
        preview_txt: String!,
        reading_time_min: Int!
        publication_time: Int!
    }

    type Query {
        getTag:     [Tag!]
        getArticle: [Article!]
    }

    type Mutation {
        addNewArticle(content: String!, author: String!): Article!
    }

    type Subscription {
        newArticle: Article!
    }
`;

// resolver handles all the incoming request to this server
const resolvers = {
  // registering a mutation
  Mutation: {
    // add new blog mutation to create new blog
    addNewArticle(_, { content, author }) {
      const blog = {
        id: blogs.length + 1,
        content,
        author,
      };
      // storing blog in the local blogs array
      blogs.push(blog);

      // once a blog is being created, we need to push the event so that frontend can catch it
      publishNewBlogAdded(content, author, blog.id);
      return blog;
    },
  },
  // registering Qyery
  Query: {
    getArticle() {
      // return all blogs
      return blogs;
    },
    getTag() {
      return tags;
    }
  },
  // setting up subscription
  Subscription: {
    // newBlog subscription
    newArticle: {
      subscribe: () => pubSub.asyncIterator([blogs_created]),
    },
  },
};

// registering our type definations and resolver for schema that we need to
// use for creating our apollo server
const schema = makeExecutableSchema({ typeDefs, resolvers });
const app = express();

// for cross origin
app.use(cors());

// creating server instance
const httpServer = createServer(app);

// initializing websocket server
// as subscriptions make use of websockets to communicate
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

const wsServerCleanup = useServer({ schema }, wsServer);

// creating apollo server with schema and server instance
const apolloServer = new ApolloServer({
  schema,
  plugins: [
    // Proper shutdown for the HTTP server.
    ApolloServerPluginDrainHttpServer({ httpServer }),

    // Proper shutdown for the WebSocket server.
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await wsServerCleanup.dispose();
          },
        };
      },
    },
  ],
});

(async function () {
  // starting the apollo server to expose endoint to client
  await apolloServer.start();
  app.use("/graphql", bodyParser.json(), expressMiddleware(apolloServer));
})();

httpServer.listen(port, () => {
  console.log(`🚀 Query endpoint ready at http://localhost:${port}/graphql`);
  console.log(
    `🚀 Subscription endpoint ready at ws://localhost:${port}/graphql`
  );
});