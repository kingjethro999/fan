import crypto from 'crypto';
import path from 'path';
import { FanMetadata } from './types.js';

const MAGIC_BYTES = Buffer.from([0x46, 0x41, 0x4e, 0x31]); // "FAN1"
const SALT_SIZE = 16;
const IV_SIZE = 12;
const TAG_SIZE = 16;
const HEADER_PREFIX_SIZE = MAGIC_BYTES.length + SALT_SIZE + IV_SIZE + TAG_SIZE; // 48 bytes
const VERSION = '1.0.0';
const PBKDF2_ITERATIONS = 50000;

/**
 * Derives AES-256 key from key buffer + salt using PBKDF2
 */
function deriveKeyWithSalt(masterKey: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, 32, 'sha256');
}

/**
 * Computes SHA-256 checksum of a buffer or string
 */
export function computeChecksum(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Encrypts file content and metadata into binary .fan format
 */
export function encryptFileContent(
  filePath: string,
  content: Buffer,
  masterKey: Buffer,
  relPath?: string
): Buffer {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath) || filename;
  const checksum = computeChecksum(content);

  const metadata: FanMetadata = {
    originalName: filename,
    originalExt: ext,
    relPath: relPath || filename,
    timestamp: Date.now(),
    checksum,
    version: VERSION,
  };

  const metaBuffer = Buffer.from(JSON.stringify(metadata), 'utf-8');
  const metaLenBuffer = Buffer.alloc(4);
  metaLenBuffer.writeUInt32BE(metaBuffer.length, 0);

  // Payload structure: [4 bytes metadata len][JSON metadata][Raw file content]
  const payloadBuffer = Buffer.concat([metaLenBuffer, metaBuffer, content]);

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_SIZE);
  const iv = crypto.randomBytes(IV_SIZE);

  // Derive AES key
  const derivedKey = deriveKeyWithSalt(masterKey, salt);

  // AES-256-GCM cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encryptedPayload = Buffer.concat([cipher.update(payloadBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Final binary stream: [MAGIC 4B][SALT 16B][IV 12B][TAG 16B][ENCRYPTED PAYLOAD]
  return Buffer.concat([MAGIC_BYTES, salt, iv, authTag, encryptedPayload]);
}

/**
 * Decrypts a .fan binary buffer back into original file metadata and raw content
 */
export function decryptFileContent(
  encryptedStream: Buffer,
  masterKey: Buffer
): { metadata: FanMetadata; content: Buffer } {
  if (encryptedStream.length < HEADER_PREFIX_SIZE) {
    throw new Error('Invalid .fan file format: File size is smaller than header header.');
  }

  // 1. Verify Magic Bytes
  const magic = encryptedStream.subarray(0, MAGIC_BYTES.length);
  if (!magic.equals(MAGIC_BYTES)) {
    throw new Error('Invalid .fan file format: Magic header mismatch ("FAN1" expected).');
  }

  // 2. Extract Salt, IV, Auth Tag
  let offset = MAGIC_BYTES.length;
  const salt = encryptedStream.subarray(offset, offset + SALT_SIZE);
  offset += SALT_SIZE;

  const iv = encryptedStream.subarray(offset, offset + IV_SIZE);
  offset += IV_SIZE;

  const authTag = encryptedStream.subarray(offset, offset + TAG_SIZE);
  offset += TAG_SIZE;

  const cipherText = encryptedStream.subarray(offset);

  // 3. Derive key & Decrypt
  const derivedKey = deriveKeyWithSalt(masterKey, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);

  let decryptedPayload: Buffer;
  try {
    decryptedPayload = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  } catch {
    throw new Error('Decryption failed: Invalid key or file corrupted/tampered.');
  }

  // 4. Extract metadata & content
  if (decryptedPayload.length < 4) {
    throw new Error('Decrypted payload corrupted: Header missing.');
  }

  const metaLen = decryptedPayload.readUInt32BE(0);
  if (decryptedPayload.length < 4 + metaLen) {
    throw new Error('Decrypted payload corrupted: Metadata length out of bounds.');
  }

  const metaBuffer = decryptedPayload.subarray(4, 4 + metaLen);
  const content = decryptedPayload.subarray(4 + metaLen);

  const metadata = JSON.parse(metaBuffer.toString('utf-8')) as FanMetadata;

  // 5. Verify Checksum
  const computedHash = computeChecksum(content);
  if (metadata.checksum && metadata.checksum !== computedHash) {
    throw new Error('Integrity check failed: Checksum mismatch in decrypted content.');
  }

  return { metadata, content };
}

/**
 * Peek at metadata without decrypting entire payload or for quick inspection
 */
export function inspectFanFile(
  encryptedStream: Buffer,
  masterKey: Buffer
): FanMetadata {
  const { metadata } = decryptFileContent(encryptedStream, masterKey);
  return metadata;
}
