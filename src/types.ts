export interface FanMetadata {
  originalName: string;
  originalExt: string;
  relPath: string;
  timestamp: number;
  checksum: string;
  version: string;
}

export interface EncryptOptions {
  target?: string;
  dir?: string;
  file?: string;
  key?: string;
  keep?: boolean;
  verbose?: boolean;
}

export interface DecryptOptions {
  target?: string;
  dir?: string;
  file?: string;
  key?: string;
  verbose?: boolean;
}

export interface OperationResult {
  filePath: string;
  outputPath?: string;
  success: boolean;
  error?: string;
  bytesProcessed?: number;
  originalName?: string;
}
