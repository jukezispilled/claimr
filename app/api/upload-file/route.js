import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/storage';
import { createContent } from '@/lib/db';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const creator = formData.get('creator');

    if (!file || !creator) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upload file to storage
    const uploadData = await uploadFile(file);

    // Create content record
    const contentData = {
      creator,
      filePath: uploadData.path,
      fileName: uploadData.name,
      fileType: uploadData.type,
      fileSize: uploadData.size,
      fileHash: uploadData.hash,
      status: 'pending',
      createdAt: new Date(),
    };

    const result = await createContent(contentData);

    return NextResponse.json({ 
      contentId: result.insertedId,
      uploadData 
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
