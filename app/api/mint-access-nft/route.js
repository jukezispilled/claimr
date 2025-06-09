import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { metaplex } from '@/lib/metaplex';
import { PublicKey, Keypair } from '@solana/web3.js';
import { createSoulboundNFT } from '@/lib/metaplex';
import { ObjectId } from 'mongodb'; // Import ObjectId

export async function POST(request) {
  console.log('API call received: POST /api/mint-access-nft');
  try {
    const { contentId, buyer, txSignature } = await request.json();
    console.log('Request body:', { contentId, buyer, txSignature });

    // Verify payment transaction
    console.log('Verifying payment transaction (placeholder - in production, verify on-chain)');
    
    const { db } = await connectToDatabase();
    console.log('Database connected.');

    // Get content details
    console.log(`Searching for content with ID: ${contentId}`);
    
    // Convert contentId to ObjectId
    let objectContentId;
    try {
      objectContentId = new ObjectId(contentId);
      console.log('Converted contentId to ObjectId:', objectContentId);
    } catch (error) {
      console.error('Invalid contentId format, not a valid ObjectId:', contentId, error);
      return NextResponse.json({ error: 'Invalid Content ID format' }, { status: 400 });
    }

    const content = await db.collection('contents').findOne({ _id: objectContentId }); // Use the ObjectId here
    if (!content) {
      console.warn('Content not found for ID:', contentId);
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    console.log('Content found:', content.title);

    // Check if user already has access
    console.log(`Checking existing access for buyer ${buyer} and content ${contentId}`);
    const existingAccess = await db.collection('access_nfts').findOne({
      contentId: objectContentId, // This might need to be objectContentId if contentId in access_nfts is also ObjectId
      owner: buyer,
    });

    if (existingAccess) {
      console.log('Access already granted for this user and content.');
      return NextResponse.json({ error: 'Access already granted' }, { status: 400 });
    }
    console.log('No existing access found, proceeding to mint NFT.');

    // Create metadata for access NFT
    const metadata = {
      name: `Access: ${content.title}`,
      description: `Access token for: ${content.description}`,
      image: 'https://arweave.net/access-token-image',
      attributes: [
        { trait_type: 'Content ID', value: contentId }, // Keep as string for metadata value
        { trait_type: 'Content Type', value: content.fileType },
        { trait_type: 'Purchased', value: new Date().toISOString() },
      ],
    };
    console.log('Access NFT metadata created:', metadata);

    const mintKeypair = Keypair.generate();
    console.log('Mint keypair generated. Public Key:', mintKeypair.publicKey.toString());
    
    // Record access NFT in database
    const accessNFT = {
      contentId: objectContentId, // Store as ObjectId if consistent with `content` collection
      owner: buyer,
      mintAddress: mintKeypair.publicKey.toString(),
      metadata,
      createdAt: new Date(),
      txSignature,
    };
    console.log('Recording access NFT in database:', accessNFT);

    await db.collection('access_nfts').insertOne(accessNFT);
    console.log('Access NFT recorded in database successfully.');

    return NextResponse.json({ 
      success: true,
      nftMint: mintKeypair.publicKey.toString(),
    });
  } catch (error) {
    console.error('Error minting access NFT:', error);
    return NextResponse.json({ error: 'Failed to mint NFT' }, { status: 500 });
  } finally {
    console.log('API call finished: POST /api/mint-access-nft');
  }
}