import fs from 'fs';
import path from 'path';

/** Default list of directories to exclude from scanning */
export const DEFAULT_EXCLUDE_DIRS = new Set([
  'node_modules',
  'venv',
  '.venv',
  'vendor',
  'vendors',
  'dist',
  'build',
  '.git',
  '.next',
  'coverage',
  '.cache',
  '.idea',
  '.vscode',
  'target',
  'out',
  'bin',
  '.gemini',
  'tmp',
  'temp',
  '.cargo',
  '.svn',
  '.hg',
]);

/** Common binary extensions to avoid if targeting 'all' text files */
export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg',
  '.zip', '.tar', '.gz', '.7z', '.rar', '.bz2',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.iso', '.dmg',
  '.fan', // Never encrypt .fan files again
]);

/**
 * Normalizes target string into array of lowercase extensions starting with '.'
 * e.g., ".txt, .md" => [".txt", ".md"]
 * e.g., "txt" => [".txt"]
 */
export function normalizeTargets(targetStr?: string): string[] {
  if (!targetStr || targetStr.trim().length === 0) {
    return [];
  }
  return targetStr
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
    .map((t) => (t.startsWith('.') ? t : `.${t}`));
}

/**
 * Parses simple .gitignore files in a directory to add extra exclusions
 */
function parseGitIgnore(dirPath: string): Set<string> {
  const gitignorePath = path.join(dirPath, '.gitignore');
  const ignoredNames = new Set<string>();

  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      const lines = content.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        // Clean leading/trailing slashes for simple match
        const clean = line.replace(/^\//, '').replace(/\/$/, '');
        if (clean && !clean.includes('*')) {
          ignoredNames.add(clean);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return ignoredNames;
}

/**
 * Recursively scans directory for target files while respecting ignore patterns
 */
export function scanDirectory(
  rootDir: string,
  options: {
    mode: 'encrypt' | 'decrypt';
    targetExtensions?: string[];
    customExcludeDirs?: string[];
  }
): string[] {
  const foundFiles: string[] = [];
  const extraIgnored = parseGitIgnore(rootDir);
  const excludeDirs = new Set([
    ...DEFAULT_EXCLUDE_DIRS,
    ...(options.customExcludeDirs || []),
    ...extraIgnored,
  ]);

  function walk(currentDir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      const fullPath = path.join(currentDir, entryName);

      // Check if directory should be skipped
      if (entry.isDirectory()) {
        if (excludeDirs.has(entryName) || entryName.startsWith('.')) {
          // Allow root scanning but skip hidden dirs like .git, .venv, etc. unless explicitly specified
          if (DEFAULT_EXCLUDE_DIRS.has(entryName) || entryName === '.git' || entryName === '.venv') {
            continue;
          }
          if (excludeDirs.has(entryName)) {
            continue;
          }
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entryName).toLowerCase();
        // Skip .fan files in encrypt mode
        if (options.mode === 'encrypt') {
          if (ext === '.fan') continue;

          if (options.targetExtensions && options.targetExtensions.length > 0) {
            // Match specific target extensions (e.g. .txt, .md, .env, or filenames like .env)
            const matchesExt = options.targetExtensions.some(
              (target) => ext === target || entryName.toLowerCase().endsWith(target)
            );
            if (matchesExt) {
              foundFiles.push(fullPath);
            }
          } else {
            // Default encrypt mode if no target extension specified: match common text extensions or non-binary
            if (!BINARY_EXTENSIONS.has(ext)) {
              foundFiles.push(fullPath);
            }
          }
        } else if (options.mode === 'decrypt') {
          // Decrypt mode: look for .fan files
          if (ext === '.fan') {
            foundFiles.push(fullPath);
          }
        }
      }
    }
  }

  walk(rootDir);
  return foundFiles;
}
