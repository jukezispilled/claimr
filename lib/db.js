import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('unlockd');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export const createContent = async (contentData) => {
  const { db } = await connectToDatabase();
  const result = await db.collection('contents').insertOne(contentData);
  return result;
};

export const getContent = async (id) => {
    const { db } = await connectToDatabase();
    // Handle both string and ObjectId
    const query = typeof id === 'string' ? { _id: new ObjectId(id) } : { _id: id };
    const content = await db.collection('contents').findOne(query);
    return content;
};
  
export const getUserContents = async (creator) => {
  const { db } = await connectToDatabase();
  const contents = await db.collection('contents').find({ creator }).toArray();
  return contents;
};

export const updateContentNFT = async (contentId, nftMint) => {
  const { db } = await connectToDatabase();
  const result = await db.collection('contents').updateOne(
    { _id: contentId },
    { $set: { nftMint, status: 'minted' } }
  );
  return result;
};
