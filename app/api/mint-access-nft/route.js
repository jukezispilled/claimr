import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { metaplex } from '@/lib/metaplex';
import { PublicKey, Keypair } from '@solana/web3.js';
import { createSoulboundNFT } from '@/lib/metaplex';

export async function POST(request) {
  try {
    const { contentId, buyer, txSignature } = await request.json();

    // Verify payment transaction
    // In production, you'd verify the transaction on-chain
    
    const { db } = await connectToDatabase();
    
    // Get content details
    const content = await db.collection('contents').findOne({ _id: contentId });
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Check if user already has access
    const existingAccess = await db.collection('access_nfts').findOne({
      contentId,
      owner: buyer,
    });

    if (existingAccess) {
      return NextResponse.json({ error: 'Access already granted' }, { status: 400 });
    }

    // Create metadata for access NFT
    const metadata = {
      name: `Access: ${content.title}`,
      description: `Access token for: ${content.description}`,
      image: 'https://arweave.net/access-token-image',
      attributes: [
        { trait_type: 'Content ID', value: contentId },
        { trait_type: 'Content Type', value: content.fileType },
        { trait_type: 'Purchased', value: new Date().toISOString() },
      ],
    };

    // In production, you'd use a proper wallet/keypair for minting
    // This is a simplified version
    const mintKeypair = Keypair.generate();
    
    // Record access NFT in database
    const accessNFT = {
      contentId,
      owner: buyer,
      mintAddress: mintKeypair.publicKey.toString(),
      metadata,
      createdAt: new Date(),
      txSignature,
    };

    await db.collection('access_nfts').insertOne(accessNFT);

    return NextResponse.json({ 
      success: true,
      nftMint: mintKeypair.publicKey.toString(),
    });
  } catch (error) {
    console.error('Error minting access NFT:', error);
    return NextResponse.json({ error: 'Failed to mint NFT' }, { status: 500 });
  }
}
