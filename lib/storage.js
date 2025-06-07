import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Encryption key should be stored securely (e.g., AWS KMS, HashiCorp Vault)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export const encryptFile = async (buffer) => {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: Buffer.concat([iv, authTag, encrypted]),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

export const decryptFile = async (encryptedData) => {
  const algorithm = 'aes-256-gcm';
  const iv = encryptedData.slice(0, 16);
  const authTag = encryptedData.slice(16, 32);
  const encrypted = encryptedData.slice(32);
  
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted;
};

export const uploadFile = async (file) => {
  const fileBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(fileBuffer);
  
  // Encrypt file
  const { encrypted, iv, authTag } = await encryptFile(buffer);
  
  // Generate unique ID
  const fileId = crypto.randomBytes(32).toString('hex');
  
  // Upload encrypted file with non-guessable name
  const { data, error } = await supabase.storage
    .from('protected-files')
    .upload(`encrypted/${fileId}`, encrypted, {
      contentType: 'application/octet-stream',
      upsert: false
    });

  if (error) throw error;
  
  return {
    fileId,
    encryptionIv: iv,
    encryptionAuthTag: authTag,
    originalName: file.name,
    size: file.size,
    type: file.type,
  };
};
