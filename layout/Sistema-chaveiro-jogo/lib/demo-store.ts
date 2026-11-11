import { getDb } from '@/lib/mongo';
import { DEMO_COOLDOWN_SECONDS } from '@/lib/play-access';

// Last demo start per client IP and game, so clearing cookies does not give a new demo.
// Document: { _id: "<ip>|<slug>", startedAt: Date, expiresAt: Date }; a TTL index on expiresAt
// removes it once the cooldown is over.

export const DEMO_STARTS_COLLECTION = 'demo_starts';
const MAX_IP_KEY_LENGTH = 64;

type DemoStartRecord = { _id: string; startedAt: Date; expiresAt: Date };

export interface DemoStartStore {
  /** Start time in seconds, or null when this IP has no demo inside the cooldown. */
  get(ip: string, slug: string): Promise<number | null>;
  record(ip: string, slug: string, startedAtSeconds: number): Promise<void>;
}

export function demoStartKey(ip: string, slug: string): string {
  return `${ip.replace(/\|/g, '').slice(0, MAX_IP_KEY_LENGTH)}|${slug}`;
}

/** In-process store: tests, and nothing else (Vercel instances share no memory). */
export function createMemoryDemoStore(): DemoStartStore {
  const records = new Map<string, number>();
  return {
    async get(ip, slug) {
      return records.get(demoStartKey(ip, slug)) ?? null;
    },
    async record(ip, slug, startedAtSeconds) {
      records.set(demoStartKey(ip, slug), startedAtSeconds);
    }
  };
}

let indexReady: Promise<unknown> | null = null;

export async function getMongoDemoStore(): Promise<DemoStartStore> {
  const db = await getDb();
  const collection = db.collection<DemoStartRecord>(DEMO_STARTS_COLLECTION);

  if (!indexReady) {
    indexReady = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
      indexReady = null;
      throw error;
    });
  }
  await indexReady;

  return {
    async get(ip, slug) {
      const record = await collection.findOne({ _id: demoStartKey(ip, slug) });
      // The TTL monitor runs about once a minute, so an expired document can still be read.
      if (!record || record.expiresAt.getTime() <= Date.now()) return null;
      return Math.floor(record.startedAt.getTime() / 1000);
    },
    async record(ip, slug, startedAtSeconds) {
      const startedAt = new Date(startedAtSeconds * 1000);
      const expiresAt = new Date((startedAtSeconds + DEMO_COOLDOWN_SECONDS) * 1000);
      await collection.updateOne(
        { _id: demoStartKey(ip, slug) },
        { $set: { startedAt, expiresAt } },
        { upsert: true }
      );
    }
  };
}
