import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI, {
  maxPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 30000,
});

let clientPromise;

/**
 * Get a connected MongoClient instance.
 * In serverless environments (Vercel), this caches the client across
 * invocations within the same warm execution context, while also
 * handling reconnection if the connection was dropped.
 */
async function getClient() {
  if (!clientPromise) {
    clientPromise = client.connect().catch(err => {
      clientPromise = null; // reset so next call retries
      throw err;
    });
  }

  try {
    // Verify the connection is still alive with a ping
    await client.db('admin').command({ ping: 1 });
  } catch {
    // Connection is stale — reconnect
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
    clientPromise = client.connect().catch(err => {
      clientPromise = null;
      throw err;
    });
  }

  return client;
}

let db;

/**
 * Get the cached database instance.
 * Reconnects automatically if the underlying connection is lost.
 */
export async function getDb() {
  const connectedClient = await getClient();
  if (!db) {
    db = connectedClient.db('javi-alert');
  }
  return db;
}

/**
 * Gracefully close the connection (useful for graceful shutdowns).
 */
export async function closeDb() {
  try {
    await client.close();
  } catch {
    // ignore
  } finally {
    clientPromise = null;
    db = null;
  }
}
