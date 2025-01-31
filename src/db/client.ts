import { PrismaClient } from "@prisma/client";
import pg, { Knex } from "knex";
import { PrismaTransaction } from "../schema/prisma";
import { env } from "../utils/env";

export const prisma = new PrismaClient();

export const getPrismaWithPostgresTx = (pgtx?: PrismaTransaction) => {
  return pgtx || prisma;
};

export const knex = pg({
  client: "pg",
  connection: {
    connectionString: env.POSTGRES_CONNECTION_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  },
  acquireConnectionTimeout: 10000,
} as Knex.Config);
