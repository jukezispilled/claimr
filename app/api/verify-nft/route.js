import { NextResponse } from 'next/server';
import { verifyNFTOwnership } from '@/lib/metaplex';

export async function POST(request) {
  try {
    const { walletAddress, nftMint } = await request.json();
    
    const hasAccess = await verifyNFTOwnership(walletAddress, nftMint);
    
    return NextResponse.json({ hasAccess });
  } catch (error) {
    console.error('Error verifying NFT:', error);
    return NextResponse.json({ error: 'Failed to verify NFT' }, { status: 500 });
  }
}
