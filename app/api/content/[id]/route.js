import { NextResponse } from 'next/server';
import { getContent } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/db';

// GET single content details
export async function GET(request, { params }) {
  try {
    // Await params before destructuring
    const { id } = await params;

    // Validate ID format
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid content ID' }, { status: 400 });
    }

    // Fetch content from database
    const content = await getContent(new ObjectId(id));

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Remove sensitive data before sending
    const safeContent = {
      _id: content._id,
      title: content.title,
      description: content.description,
      creator: content.creator,
      price: content.price,
      fileType: content.fileType,
      fileSize: content.fileSize,
      fileName: content.fileName,
      nftMint: content.nftMint,
      status: content.status,
      createdAt: content.createdAt,
    };

    return NextResponse.json(safeContent);
  } catch (error) {
    console.error('Error fetching content:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

// UPDATE content (for creator only)
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { walletAddress, updates } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 });
    }

    // Get content to verify ownership
    const content = await getContent(new ObjectId(id));
    
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Verify the requester is the creator
    if (content.creator !== walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Allow only specific fields to be updated
    const allowedUpdates = ['title', 'description', 'price'];
    const filteredUpdates = {};
    
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    // Update in database
    const { db } = await connectToDatabase();
    const result = await db.collection('contents').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: {
          ...filteredUpdates,
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'No changes made' }, { status: 400 });
    }

    return NextResponse.json({ success: true, updated: filteredUpdates });
  } catch (error) {
    console.error('Error updating content:', error);
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
  }
}

// DELETE content (for creator only)
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 });
    }

    // Get content to verify ownership
    const content = await getContent(new ObjectId(id));
    
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Verify the requester is the creator
    if (content.creator !== walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete from database
    const { db } = await connectToDatabase();
    const result = await db.collection('contents').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Error deleting content:', error);
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
  }
}
