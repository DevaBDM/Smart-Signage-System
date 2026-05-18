const { PrismaClient } = require("@prisma/client");

/** Use TEST_DATABASE_URL in test mode so the app and test helpers
 *  talk to the same database. Falls back to DATABASE_URL otherwise. */
const dbUrl =
  process.env.NODE_ENV === "test" && process.env.TEST_DATABASE_URL
    ? process.env.TEST_DATABASE_URL
    : undefined;

const prisma = dbUrl
  ? new PrismaClient({ datasources: { db: { url: dbUrl } } })
  : new PrismaClient();

module.exports = prisma;
