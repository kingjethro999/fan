import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const FAN_CONFIG_DIR = path.join(os.homedir(), '.fan');
const MASTER_KEY_FILE = path.join(FAN_CONFIG_DIR, 'master.key');

/**
 * Retrieves the encryption key from CLI flag, environment variable, or user's master key file.
 * Generates a master key if one does not exist.
 */
export function getOrCreateKey(customKey?: string): { key: Buffer; source: string } {
  // 1. Explicit CLI argument
  if (customKey && customKey.trim().length > 0) {
    return {
      key: deriveKeyFromSecret(customKey.trim()),
      source: 'CLI Option (--key)',
    };
  }

  // 2. Environment Variable
  if (process.env.FAN_KEY && process.env.FAN_KEY.trim().length > 0) {
    return {
      key: deriveKeyFromSecret(process.env.FAN_KEY.trim()),
      source: 'Environment Variable (FAN_KEY)',
    };
  }

  // 3. User Master Key file (~/.fan/master.key)
  try {
    if (!fs.existsSync(FAN_CONFIG_DIR)) {
      fs.mkdirSync(FAN_CONFIG_DIR, { recursive: true, mode: 0o700 });
    }

    if (fs.existsSync(MASTER_KEY_FILE)) {
      const existingHex = fs.readFileSync(MASTER_KEY_FILE, 'utf-8').trim();
      if (existingHex.length >= 32) {
        return {
          key: deriveKeyFromSecret(existingHex),
          source: `Master Key (${MASTER_KEY_FILE})`,
        };
      }
    }

    // Auto-generate new Master Key
    const newHexKey = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(MASTER_KEY_FILE, newHexKey, { mode: 0o600 });
    return {
      key: deriveKeyFromSecret(newHexKey),
      source: `Generated Master Key (${MASTER_KEY_FILE})`,
    };
  } catch {
    // Fallback if home directory is read-only
    const fallbackSecret = `fan-fallback-${os.hostname()}-${os.userInfo().username}`;
    return {
      key: deriveKeyFromSecret(fallbackSecret),
      source: 'System Fallback Key',
    };
  }
}

/**
 * Derives a consistent 32-byte (256-bit) buffer key using SHA-256 hash.
 */
export function deriveKeyFromSecret(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf-8').digest();
}

/**
 * Manually sets and saves a master key / passphrase to ~/.fan/master.key
 */
export function setMasterKey(secretOrHex: string): string {
  if (!fs.existsSync(FAN_CONFIG_DIR)) {
    fs.mkdirSync(FAN_CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  const keyHex = secretOrHex.length === 64 && /^[0-9a-fA-F]+$/.test(secretOrHex)
    ? secretOrHex.toLowerCase()
    : deriveKeyFromSecret(secretOrHex).toString('hex');

  fs.writeFileSync(MASTER_KEY_FILE, keyHex, { mode: 0o600 });
  return MASTER_KEY_FILE;
}

