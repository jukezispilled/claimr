import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getContent } from '@/lib/db'; // Assuming this path is correct for your DB utility
import { decryptFile } from '@/lib/storage'; // Assuming this path is correct for your storage utility
import { verifyWalletSignature, verifyNFTOwnership, generateAccessToken } from '@/lib/auth'; // Assuming this path is correct for your auth utility
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request, { params }) {
  try {
    const { id } = params; // params is already an object containing the ID

    const { db } = await connectToDatabase();
    console.log('Database connected.');

    const body = await request.json();
    const { walletAddress, signature, message } = body;

    // --- Enhanced Logging: Input data ---
    console.log(`[Auth API] Received request for content ID: ${id}`);
    console.log(`[Auth API] Wallet Address: ${walletAddress}`);
    // Do not log signature or message directly in production due to sensitive info

    // Step 1: Verify wallet signature
    const isValidSignature = await verifyWalletSignature(walletAddress, signature, message);
    if (!isValidSignature) {
      console.warn(`[Auth API] Invalid signature for wallet: ${walletAddress}`);
      // Return JSON error response
      return NextResponse.json({ error: 'Invalid wallet signature' }, { status: 401 });
    }
    console.log(`[Auth API] Wallet signature verified successfully.`);

    // Step 2: Verify message is recent (prevent replay attacks)
    const messageData = JSON.parse(message);
    const messageTime = new Date(messageData.timestamp);
    const now = new Date();
    const timeDiff = now.getTime() - messageTime.getTime(); // Use getTime() for numeric comparison

    if (timeDiff > 30000 || timeDiff < -5000) { // 30 seconds for expiration, small buffer for future timestamps
      console.warn(`[Auth API] Signature expired or timestamp invalid for wallet: ${walletAddress}. Time difference: ${timeDiff}ms`);
      // Return JSON error response
      return NextResponse.json({ error: 'Signature expired or invalid timestamp' }, { status: 401 });
    }
    console.log(`[Auth API] Message timestamp is recent.`);

    // Step 3: Get content details
    const content = await getContent(id);
    if (!content) {
      console.error(`[Auth API] Content not found for ID: ${id}`);
      // Return JSON error response
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    // --- Enhanced Logging: Content retrieved from DB ---
    console.log(`[Auth API] Content retrieved for ID ${id}:`, content);

    // --- Critical Check: Ensure nftMint exists on the content object ---
    if (!content.nftMint) {
      console.error(`[Auth API] Content for ID ${id} is missing 'nftMint' property. Cannot verify ownership.`);
      // Return JSON error response
      return NextResponse.json({ error: 'Content configuration error: Missing NFT Mint address' }, { status: 500 });
    }

    // Step 4: Verify NFT ownership on-chain
    console.log(`[Auth API] Attempting to verify NFT ownership for wallet: ${walletAddress} with NFT Mint: ${content.nftMint}`);
    const hasAccess = await verifyNFTOwnership(walletAddress, content.nftMint);
    const existingAccess = await db.collection('access_nfts').findOne({
      contentId: content._id, // Assuming content._id is the ObjectId for the content
      owner: walletAddress, // Assuming walletAddress is the owner's identifier
    });

    if (!hasAccess && !existingAccess) {
      console.warn(`[Auth API] Access denied: Wallet ${walletAddress} does not own NFT ${content.nftMint} and has no existing access.`);
      // Return JSON error response
      return NextResponse.json({ error: 'Access denied. You do not own the required NFT and have no existing access.' }, { status: 403 });
    }
    console.log(`[Auth API] NFT ownership verified successfully.`);

    // Step 5: Generate time-limited access token (though not directly used for download in this combined flow)
    const accessToken = generateAccessToken(walletAddress, id);
    console.log(`[Auth API] Access token generated for wallet: ${walletAddress}`);

    // Step 6: Decrypt and prepare file for download immediately
    let fileUrl;
    let fileBuffer;

    try {
      // Check if file needs decryption or is already accessible
      if (content.filePath) {
        console.log(`[Auth API] Decrypting file for content ID: ${id}`);

        // Decrypt the file
        const decryptedFileData = await decryptFile(content.filePath, content.encryptionKey);

        // Handle different return types from decryptFile
        if (decryptedFileData instanceof Buffer) {
          fileBuffer = decryptedFileData;
        } else if (decryptedFileData instanceof Uint8Array) {
          fileBuffer = Buffer.from(decryptedFileData);
        } else if (typeof decryptedFileData === 'string') {
          // If decryptFile returns a URL (e.g., pre-signed URL), use it directly
          fileUrl = decryptedFileData;
        } else {
          throw new Error('Invalid decrypted file data format from decryptFile utility');
        }

        console.log(`[Auth API] File decrypted successfully`);

      } else if (content.basicfilePath) {
        // File is not encrypted, get it from storage directly
        console.log(`[Auth API] Getting unencrypted file from storage: ${content.filePath}`);

        // Download the file from Supabase storage
        const { data, error } = await supabase.storage
          .from(process.env.SUPABASE_STORAGE_BUCKET || 'files') // Ensure bucket name is correct
          .download(content.filePath);

        if (error) {
          console.error(`Supabase download error:`, error);
          throw new Error(`Failed to download file from Supabase: ${error.message}`);
        }

        // Convert to buffer
        fileBuffer = Buffer.from(await data.arrayBuffer());

        console.log(`[Auth API] Unencrypted file fetched from Supabase successfully`);

      } else if (content.fileUrl) {
        // Direct external file URL - fetch the file
        console.log(`[Auth API] Fetching file from direct URL: ${content.fileUrl}`);

        const response = await fetch(content.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file from direct URL: ${response.statusText} (${response.status})`);
        }

        fileBuffer = Buffer.from(await response.arrayBuffer());
        console.log(`[Auth API] File fetched from direct URL successfully`);

      } else {
        console.error(`[Auth API] No valid file path (encrypted, unencrypted, or URL) found for content ID: ${id}`);
        // Return JSON error response
        return NextResponse.json({ error: 'File data not configured for this content' }, { status: 404 });
      }

      console.log(`[Auth API] File prepared successfully for content ID: ${id}`);

    } catch (fileRetrievalError) {
      console.error(`[Auth API] File decryption/retrieval failed for content ID: ${id}:`, fileRetrievalError);
      // Return JSON error response
      return NextResponse.json({ error: 'Failed to prepare file for download' }, { status: 500 });
    }

    // Return the file for download directly
    if (fileUrl) {
      // If we have a direct URL (e.g., a pre-signed URL from decryptFile), return it in JSON
      console.log(`[Auth API] Responding with direct file URL: ${fileUrl}`);
      return NextResponse.json({
        success: true,
        fileUrl: fileUrl,
        fileName: content.fileName || `download_${id}`,
        contentType: content.contentType || 'application/octet-stream'
      });
    } else if (fileBuffer) {
      // If we have a buffer, return the file directly as binary
      console.log(`[Auth API] Responding with binary file data, size: ${fileBuffer.length} bytes`);
      const headers = new Headers();
      headers.set('Content-Type', content.contentType || 'application/octet-stream');
      headers.set('Content-Disposition', `attachment; filename="${content.fileName || `download_${id}`}"`);
      headers.set('Content-Length', fileBuffer.length.toString());

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: headers
      });
    } else {
      console.error(`[Auth API] No file URL or buffer available after processing for content ID: ${id}`);
      // Fallback in case neither fileUrl nor fileBuffer is available, though previous checks should catch this
      return NextResponse.json({ error: 'Internal server error: No file data to send' }, { status: 500 });
    }

  } catch (error) {
    // --- Enhanced Error Logging in the main catch block ---
    console.error('--- Critical Error in Auth API Route ---');
    console.error('Error verifying access or serving file:', error);
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack); // This is crucial for tracing the origin of the error
    console.error('-------------------------------------');

    // Return a more informative error message to the client, but hide sensitive details
    return NextResponse.json(
      {
        error: 'An unexpected server error occurred.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined // Only show details in dev
      },
      { status: 500 }
    );
  }
}