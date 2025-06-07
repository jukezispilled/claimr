import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const creator = searchParams.get('creator');
    const walletAddress = request.headers.get('x-wallet-address');

    const { db } = await connectToDatabase();
    
    let query = { status: 'minted' };
    if (creator) {
      query.creator = creator;
    }

    const contents = await db.collection('contents').find(query).toArray();

    // Check if user owns each content (if wallet connected)
    if (walletAddress) {
      const ownedNFTs = await db.collection('access_nfts').find({
        owner: walletAddress,
      }).toArray();

      const ownedContentIds = ownedNFTs.map(nft => nft.contentId);

      contents.forEach(content => {
        content.owned = ownedContentIds.includes(content._id.toString());
      });
    }

    return NextResponse.json(contents);
  } catch (error) {
    console.error('Error fetching contents:', error);
    return NextResponse.json({ error: 'Failed to fetch contents' }, { status: 500 });
  }
}
