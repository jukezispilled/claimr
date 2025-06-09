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
      // Use the properties returned by uploadFile
      fileId: uploadData.fileId, // Use fileId for unique identification in your database
      originalName: uploadData.originalName,
      fileType: uploadData.type,
      fileSize: uploadData.size,
      // You might want to store encryptionIv and encryptionAuthTag in your database
      // to be able to decrypt the file later.
      encryptionIv: uploadData.encryptionIv,
      encryptionAuthTag: uploadData.encryptionAuthTag,
      status: 'pending',
      createdAt: new Date(),
      // If you need a 'filePath' or 'hash', you'll need to generate them or derive them
      // within your uploadFile function or after the upload.
      // For Supabase Storage, the 'path' is often constructed from the bucket and filename.
      // In your case, it would be 'encrypted/{fileId}'
      filePath: `encrypted/${uploadData.fileId}`, // Construct the path
      // If you want a fileHash, you would need to calculate it before encryption or from the original buffer
      // For now, removing fileHash as it's not returned by uploadFile
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