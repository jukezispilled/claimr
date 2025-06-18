// api/contents/route.js
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db'; // Your database connection utility
import { ObjectId } from 'mongodb'; // Import ObjectId for converting string IDs back to MongoDB ObjectId

// This is for fetching content (your existing GET logic)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const creator = searchParams.get('creator');
    const walletAddress = request.headers.get('x-wallet-address'); // Get wallet address from header

    const { db } = await connectToDatabase();

    let query = { status: 'minted' }; // Only show content that has been successfully minted
    if (creator) {
      query.creator = creator;
    }

    const contents = await db.collection('contents').find(query).toArray();

    // Check if user owns each content (if wallet connected)
    if (walletAddress) {
      // Fetch all access NFTs owned by the connected wallet
      const ownedNFTs = await db.collection('access_nfts').find({
        owner: walletAddress,
      }).toArray();

      // Create a set of contentIds that the user owns for quick lookup
      const ownedContentIds = new Set(ownedNFTs.map(nft => nft.contentId.toString())); // Ensure string comparison

      contents.forEach(content => {
        // Mark content as owned if the _id matches an ownedContentId
        content.owned = ownedContentIds.has(content._id.toString());
      });
    }

    return NextResponse.json(contents);
  } catch (error) {
    console.error('Error fetching contents:', error);
    return NextResponse.json({ error: 'Failed to fetch contents' }, { status: 500 });
  }
}

// This is for creating new content (the POST method)
export async function POST(request) {
  try {
    const body = await request.json(); // Parse the JSON body from the request

    const {
      title,
      description,
      price,
      category,
      creator,
      fileId,        // From the initial file upload
      fileName,      // From the initial file upload
      fileType,      // From the initial file upload
      fileSize,      // From the initial file upload
      nftMint,       // The mint address of the soulbound NFT
    } = body;

    const missingFields = [];

    if (!title) missingFields.push('title');
    if (!description) missingFields.push('description');
    // Check for price explicitly, as 0 can be a valid price, but null/undefined/empty string are not
    if (price === undefined || price === null || price === '') missingFields.push('price');
    if (!creator) missingFields.push('creator');
    if (!fileId) missingFields.push('fileId');
    if (!nftMint) missingFields.push('nftMint');


    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }
    const { db } = await connectToDatabase();

    // Create the content document to save in MongoDB
    const contentDocument = {
      title,
      description,
      price: parseFloat(price), // Ensure price is stored as a number
      category,
      creator,
      fileId,
      fileName,
      fileType,
      fileSize,
      filePath: `encrypted/${fileId}`,
      nftMint,           // Store the NFT mint address
      status: 'minted',  // Mark as 'minted' since NFT creation was successful
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('contents').insertOne(contentDocument);

    // After successfully saving the content, you might also want to save the
    // details of the access NFT to a separate collection (e.g., `access_nfts`).
    // This allows you to easily query for NFTs owned by a wallet without
    // iterating through all 'contents' or hitting the blockchain for every content.
    // This is useful for your 'owned' check in the GET route.

    // Example of saving access NFT details (optional but recommended for ownership checks)
    // Note: The owner of this initial soulbound NFT is the creator themselves.
    // If a *buyer* later acquires an access NFT, that would be a separate record.
    const accessNftDocument = {
      nftMint: nftMint,
      contentId: result.insertedId, // Link to the content document's _id
      owner: creator, // The creator is the initial owner of this specific NFT
      type: 'soulbound_access', // Custom type to distinguish from other NFTs if needed
      mintedAt: new Date(),
    };
    await db.collection('access_nfts').insertOne(accessNftDocument);


    return NextResponse.json({
      message: 'Content and NFT data saved successfully',
      id: result.insertedId, // Return the ID of the newly created content
      content: contentDocument // Return the saved content document
    }, { status: 201 }); // 201 Created status
  } catch (error) {
    console.error('Error saving content:', error);
    return NextResponse.json({ error: error.message || 'Failed to save content' }, { status: 500 });
  }
}