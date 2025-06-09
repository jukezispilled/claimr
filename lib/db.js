import { MongoClient, ObjectId } from 'mongodb'; // <--- ADDED ObjectId HERE

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    console.log('[DB] Using cached database connection.');
    return { client: cachedClient, db: cachedDb };
  }

  // Ensure MONGODB_URI is set in your environment variables
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }

  console.log('[DB] Connecting to new database instance...');
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('unlockd'); // Ensure 'unlockd' is your correct database name

  cachedClient = client;
  cachedDb = db;

  console.log('[DB] Successfully connected to database.');
  return { client, db };
}

export const createContent = async (contentData) => {
  const { db } = await connectToDatabase();
  console.log('[DB] Inserting new content...');
  const result = await db.collection('contents').insertOne(contentData);
  console.log('[DB] Content inserted:', result.insertedId);
  return result;
};

export const getContent = async (id) => {
    const { db } = await connectToDatabase();
    console.log(`[DB] Fetching content for ID: ${id} (Type: ${typeof id})`);
    
    let query;
    try {
        // Handle both string and ObjectId
        // If 'id' is a string, attempt to convert it to ObjectId.
        // This is necessary because MongoDB stores _id as ObjectId.
        query = typeof id === 'string' ? { _id: new ObjectId(id) } : { _id: id };
    } catch (error) {
        console.error(`[DB] Error creating ObjectId for ID '${id}':`, error);
        // If the string is not a valid ObjectId format, this will prevent an error later.
        // You might want to handle this case differently, e.g., return null or throw.
        return null; 
    }

    const content = await db.collection('contents').findOne(query);
    console.log(`[DB] Content fetch result for ID ${id}: ${content ? 'Found' : 'Not Found'}`);
    return content;
};
  
export const getUserContents = async (creator) => {
  const { db } = await connectToDatabase();
  console.log(`[DB] Fetching contents for creator: ${creator}`);
  const contents = await db.collection('contents').find({ creator }).toArray();
  console.log(`[DB] Found ${contents.length} contents for creator.`);
  return contents;
};

export const updateContentNFT = async (contentId, nftMint) => {
  const { db } = await connectToDatabase();
  console.log(`[DB] Updating content ${contentId} with NFT mint: ${nftMint}`);
  
  let objectIdContentId;
  try {
      // Ensure contentId is an ObjectId when updating by _id
      objectIdContentId = typeof contentId === 'string' ? new ObjectId(contentId) : contentId;
  } catch (error) {
      console.error(`[DB] Error creating ObjectId for contentId '${contentId}' during update:`, error);
      throw new Error('Invalid contentId format for update.');
  }

  const result = await db.collection('contents').updateOne(
    { _id: objectIdContentId }, // Use the converted ObjectId
    { $set: { nftMint, status: 'minted' } }
  );
  console.log(`[DB] Content update result for ${contentId}: Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);
  return result;
};