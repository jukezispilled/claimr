import { NextResponse } from 'next/server';
import { getContent } from '@/lib/db';
import { decryptFile } from '@/lib/storage';
import { verifyWalletSignature, verifyNFTOwnership, generateAccessToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { walletAddress, signature, message } = body;

    // Step 1: Verify wallet signature
    const isValidSignature = await verifyWalletSignature(walletAddress, signature, message);
    if (!isValidSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Step 2: Verify message is recent (prevent replay attacks)
    const messageData = JSON.parse(message);
    const messageTime = new Date(messageData.timestamp);
    const now = new Date();
    const timeDiff = now - messageTime;
    
    if (timeDiff > 30000) { // 30 seconds
      return NextResponse.json({ error: 'Signature expired' }, { status: 401 });
    }

    // Step 3: Get content details
    const content = await getContent(id);
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Step 4: Verify NFT ownership on-chain
    const hasAccess = await verifyNFTOwnership(walletAddress, content.nftMint);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Step 5: Generate time-limited access token
    const accessToken = generateAccessToken(walletAddress, id);

    return NextResponse.json({ 
      accessToken,
      expiresIn: 900 // 15 minutes
    });
  } catch (error) {
    console.error('Error verifying access:', error);
    return NextResponse.json({ error: 'Failed to verify access' }, { status: 500 });
  }
}

// Separate endpoint for actual file download
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.contentId !== id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get content details
    const content = await getContent(id);
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Download encrypted file
    const { data, error } = await supabase.storage
      .from('protected-files')
      .download(`encrypted/${content.fileId}`);

    if (error) throw error;

    // Decrypt file
    const encryptedBuffer = Buffer.from(await data.arrayBuffer());
    const decryptedBuffer = await decryptFile(encryptedBuffer);

    // Return decrypted file
    return new NextResponse(decryptedBuffer, {
      headers: {
        'Content-Type': content.fileType,
        'Content-Disposition': `attachment; filename="${content.originalName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
  }
}