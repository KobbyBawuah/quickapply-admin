import mongoose from "mongoose";
import { logger } from "./logger.js";

let isConnected = false;

function getMongoDbName(): string {
  return (
    process.env.MONGO_DB_NAME ||
    process.env.MONGODB_DB ||
    "test"
  ).trim();
}

export async function connectMongoDB(uri?: string): Promise<void> {
  const mongoUri = uri || process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not set");
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      dbName: getMongoDbName(),
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;

    logger.info(
      {
        dbName: mongoose.connection.db?.databaseName,
        readyState: mongoose.connection.readyState,
      },
      "MongoDB connected"
    );
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed");
    throw err;
  }
}

export async function testMongoConnection(
  uri: string,
  dbName?: string,
  collection?: string
): Promise<{
  success: boolean;
  message: string;
  databaseName?: string;
  userCount?: number;
}> {
  const conn = mongoose.createConnection();

  try {
    await conn.openUri(uri, {
      dbName: dbName || getMongoDbName(),
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    const db = conn.db;

    if (!db) {
      throw new Error("Could not access MongoDB database");
    }

    const colName = collection || process.env.USERS_COLLECTION || "users";
    const count = await db.collection(colName).countDocuments();

    await conn.close();

    return {
      success: true,
      message: `Connected successfully. Found ${count} users.`,
      databaseName: db.databaseName,
      userCount: count,
    };
  } catch (err: any) {
    try {
      await conn.close();
    } catch {
      // ignore
    }

    return {
      success: false,
      message: err?.message || "Connection failed",
    };
  }
}

export { mongoose };