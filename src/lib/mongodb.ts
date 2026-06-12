import mongoose from "mongoose";

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = global as typeof globalThis & {
  mongooseCache?: CachedConnection;
};

const cached = globalWithMongoose.mongooseCache ?? {
  conn: null,
  promise: null
};

globalWithMongoose.mongooseCache = cached;

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI غير مضبوط في ملف البيئة.");
  }

  if (cached.conn) {
    return cached.conn;
  }

  cached.promise ??= mongoose.connect(MONGODB_URI, {
    dbName: "chatzi",
    bufferCommands: false
  });

  cached.conn = await cached.promise;
  return cached.conn;
}
