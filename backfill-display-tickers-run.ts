import axios from 'axios';
import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';
import { Instrument } from 'C:/dev/backend/trading212-bot-api/src/trading212/interfaces/trading212.interfaces';
import { resolveDisplayTicker } from 'C:/dev/backend/trading212-bot-api/src/trading212/utils/display-ticker';

dotenv.config({ path: 'C:/dev/backend/trading212-bot-api/.env' });

const LIVE_BASE_URL = 'https://live.trading212.com/api/v0';
const DEMO_BASE_URL = 'https://demo.trading212.com/api/v0';

interface MetadataLookup {
  byTicker: Map<string, Instrument>;
  byIsin: Map<string, Instrument>;
}

async function fetchMetadata(): Promise<Instrument[]> {
  const apiKey = process.env.TRADING212_API_KEY;
  const apiSecret = process.env.TRADING212_API_SECRET;
  if (!apiKey || !apiSecret) return [];
  const environment = process.env.TRADING212_ENVIRONMENT === 'live' ? 'live' : 'demo';
  const baseURL = environment === 'live' ? LIVE_BASE_URL : DEMO_BASE_URL;
  const encoded = Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64');
  const { data } = await axios.get<Instrument[]>('/equity/metadata/instruments', {
    baseURL,
    headers: {
      Authorization: `Basic ${encoded}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 10_000,
  });
  return data;
}

async function loadMetadataLookup(): Promise<MetadataLookup> {
  const instruments = await fetchMetadata().catch((err: unknown) => {
    console.warn(`Instrument metadata unavailable; using fallback parser only: ${(err as Error).message}`);
    return [] as Instrument[];
  });
  const byTicker = new Map<string, Instrument>();
  const byIsin = new Map<string, Instrument>();
  for (const instrument of instruments) {
    if (instrument.ticker) byTicker.set(instrument.ticker, instrument);
    if (instrument.isin) byIsin.set(instrument.isin, instrument);
  }
  return { byTicker, byIsin };
}

async function backfillCollection(collection: mongoose.mongo.Collection, metadata: MetadataLookup, options: { isinField?: string } = {}): Promise<number> {
  const cursor = collection.find({
    ticker: { $exists: true, $ne: null },
    $or: [
      { internalTicker: { $exists: false } },
      { internalTicker: null },
      { displayTicker: { $exists: false } },
      { displayTicker: null },
      { displayTicker: '' },
    ],
  });
  let updated = 0;
  for await (const doc of cursor) {
    const ticker = typeof doc.ticker === 'string' ? doc.ticker : '';
    const internalTicker = typeof doc.internalTicker === 'string' && doc.internalTicker.trim() ? doc.internalTicker : ticker;
    const isin = options.isinField && typeof doc[options.isinField] === 'string' ? doc[options.isinField] : null;
    const metadataInstrument = metadata.byTicker.get(internalTicker) ?? (isin ? metadata.byIsin.get(isin) : undefined);
    const $set: Record<string, string> = {};
    if (!doc.internalTicker) $set.internalTicker = internalTicker;
    if (!doc.displayTicker) {
      $set.displayTicker = resolveDisplayTicker({ internalTicker, isin, metadataInstrument });
    }
    if (Object.keys($set).length === 0) continue;
    const result = await collection.updateOne({ _id: doc._id }, { $set });
    updated += result.modifiedCount;
  }
  return updated;
}

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');
  const connection = await mongoose.createConnection(uri).asPromise();
  console.log('Connected to MongoDB');
  const db = connection.db;
  if (!db) throw new Error('Could not access database after connect');
  const metadata = await loadMetadataLookup();
  const orders = await backfillCollection(db.collection('trading212_orders'), metadata, { isinField: 'instrumentIsin' });
  const dividends = await backfillCollection(db.collection('trading212_dividends'), metadata);
  console.log(`trading212_orders: updated ${orders} document(s)`);
  console.log(`trading212_dividends: updated ${dividends} document(s)`);
  await connection.close();
  console.log('Migration complete.');
}

run().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
