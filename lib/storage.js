import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Ensure ENCRYPTION_KEY is a 32-byte (256-bit) hex string
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// You might want to make sure ENCRYPTION_KEY is valid on startup
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) { // 32 bytes * 2 hex chars/byte = 64
    console.error('Error: ENCRYPTION_KEY is missing or not a 64-character hex string.');
    // Consider exiting the process or throwing an error if this is critical
}

export const encryptFile = async (buffer) => {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16); // 16 bytes for AES-GCM IV
  
  // Ensure the ENCRYPTION_KEY is a Buffer of 32 bytes
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (keyBuffer.length !== 32) {
      throw new Error("Encryption key must be 32 bytes for AES-256-GCM.");
  }

  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes for AES-GCM Auth Tag
  
  // Store IV and AuthTag concatenated with the encrypted data
  // Order: IV (16 bytes) | AuthTag (16 bytes) | Encrypted Data
  return {
    encrypted: Buffer.concat([iv, authTag, encrypted]), // This is the buffer to upload to storage
    iv: iv.toString('hex'), // For potential separate storage/debugging
    authTag: authTag.toString('hex') // For potential separate storage/debugging
  };
};

// =====================================================================
// FIX IS PRIMARILY IN THIS DECRYPTFILE FUNCTION
// =====================================================================
export const decryptFile = async (encryptedFilePath, encryptionKeyFromDb) => {
  const algorithm = 'aes-256-gcm';
  
  // Step 1: Download the encrypted file from Supabase storage
  console.log(`[decryptFile] Downloading encrypted file from: ${encryptedFilePath}`);
  const { data: encryptedBlob, error: downloadError } = await supabase.storage
    .from('protected-files') // Make sure this bucket name is correct!
    .download(encryptedFilePath);

  if (downloadError) {
    console.error(`[decryptFile] Supabase download error for ${encryptedFilePath}:`, downloadError);
    throw new Error(`Failed to download encrypted file from Supabase: ${downloadError.message}`);
  }

  const downloadedEncryptedBuffer = Buffer.from(await encryptedBlob.arrayBuffer());
  console.log(`[decryptFile] Downloaded encrypted buffer size: ${downloadedEncryptedBuffer.length} bytes`);

  // Step 2: Extract IV, Auth Tag, and actual encrypted data
  // Based on your encryptFile: IV (16 bytes) | AuthTag (16 bytes) | Encrypted Data
  const IV_LENGTH = 16;
  const AUTH_TAG_LENGTH = 16;

  if (downloadedEncryptedBuffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted data is too short; IV or Auth Tag might be missing.");
  }

  const iv = downloadedEncryptedBuffer.slice(0, IV_LENGTH);
  const authTag = downloadedEncryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedPayload = downloadedEncryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);

  console.log(`[decryptFile] Extracted IV: ${iv.toString('hex')}`);
  console.log(`[decryptFile] Extracted AuthTag: ${authTag.toString('hex')}`);
  console.log(`[decryptFile] Encrypted payload size: ${encryptedPayload.length} bytes`);

  // Step 3: Prepare the decryption key
  // The 'encryptionKeyFromDb' parameter passed from route.js is currently unused.
  // We're using the global ENCRYPTION_KEY here. Ensure consistency!
  // If `content.encryptionKey` from DB is meant to be the key, use that.
  // If ENCRYPTION_KEY is a global, ensure it's the correct one.
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex'); // Assuming ENCRYPTION_KEY is a global constant
  // OR, if you store a unique key per file in the DB:
  // const keyBuffer = Buffer.from(encryptionKeyFromDb, 'hex'); // Use this if `content.encryptionKey` is the actual key.

  if (keyBuffer.length !== 32) { // 32 bytes = 256 bits
      throw new Error(`Decryption key length mismatch. Expected 32 bytes, got ${keyBuffer.length}.`);
  }

  // Step 4: Decrypt
  try {
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    decipher.setAuthTag(authTag); // Set the authentication tag

    const decrypted = Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);
    console.log(`[decryptFile] File decrypted successfully. Decrypted size: ${decrypted.length} bytes`);
    return decrypted;

  } catch (decryptionError) {
    console.error(`[decryptFile] Decryption failed:`, decryptionError.message);
    throw new Error(`Decryption failed: Unsupported state or unable to authenticate data. This usually means the key, IV, or Auth Tag are incorrect, or the data is corrupted. Original error: ${decryptionError.message}`);
  }
};

export const uploadFile = async (file) => {
  const fileBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(fileBuffer);
  
  // Encrypt file
  const { encrypted, iv, authTag } = await encryptFile(buffer); // 'encrypted' here already includes IV and AuthTag

  // Generate unique ID
  const fileId = crypto.randomBytes(32).toString('hex');
  
  // Upload encrypted file with non-guessable name
  const { data, error } = await supabase.storage
    .from('protected-files') // Make sure this bucket name ('protected-files') matches your download bucket
    .upload(`encrypted/${fileId}`, encrypted, { // 'encrypted' is the combined buffer
      contentType: 'application/octet-stream', // Store as generic binary
      upsert: false
    });

  if (error) {
      console.error(`[uploadFile] Supabase upload error:`, error);
      throw error;
  }
  
  // This is the data you should save to your database for this content ID
  return {
    fileId, // This is the ID for the filename in storage
    encryptedFilePath: `encrypted/${fileId}`, // Store this in content.encryptedFilePath
    // Note: iv and authTag are *part of the encrypted file* for this scheme.
    // So you don't necessarily need to store them separately in the DB if they are
    // always prepended to the file as done in encryptFile.
    // If you *do* store them separately, then decryptFile must fetch them from the DB.
    // For this setup (IV+AuthTag in the file), `encryptionIv` and `encryptionAuthTag` below are redundant
    // for decryption purposes, but might be useful for debugging or auditing.
    encryptionIv: iv,       // Redundant if IV is prepended to file, but ok to store
    encryptionAuthTag: authTag, // Redundant if AuthTag is prepended to file, but ok to store
    originalName: file.name,
    size: file.size, // This is the original size, not the encrypted size
    type: file.type, // This is the original type, not application/octet-stream
  };
};