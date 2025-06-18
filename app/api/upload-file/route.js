// api/upload/route.js
import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/storage';
import { createContent } from '@/lib/db'; // Assuming createContent exists and is correctly implemented

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const creator = formData.get('creator');

    if (!file || !creator) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upload file to storage
    const uploadData = await uploadFile(file); // This returns { fileId, encryptionIv, encryptionAuthTag, originalName, size, type }

    // Create content record
    const contentData = {
      creator,
      fileId: uploadData.fileId, // Use fileId for unique identification in your database
      originalName: uploadData.originalName,
      fileType: uploadData.type,
      fileSize: uploadData.size,
      encryptionIv: uploadData.encryptionIv,
      encryptionAuthTag: uploadData.encryptionAuthTag,
      status: 'pending',
      createdAt: new Date(),
      filePath: `encrypted/${uploadData.fileId}`, // Construct the path
    };

    const result = await createContent(contentData); // Assuming createContent expects these fields

    return NextResponse.json({
      contentId: result.insertedId, // Assuming createContent returns an object with insertedId
      uploadData
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}