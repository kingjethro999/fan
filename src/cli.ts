import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import pc from 'picocolors';
import { getOrCreateKey, setMasterKey } from './keyManager.js';
import { encryptFileContent, decryptFileContent, inspectFanFile } from './crypto.js';
import { scanDirectory, normalizeTargets } from './scanner.js';
import {
  printBanner,
  printHelp,
  logSuccess,
  logError,
  logInfo,
  logWarning,
  printSummary,
} from './ui.js';
import { EncryptOptions, DecryptOptions } from './types.js';

const program = new Command();

program
  .name('fan')
  .description('High-performance binary encryptor CLI tool for custom .fan files')
  .version('1.0.0');

// Help override
program.helpInformation = () => '';
program.on('option:help', () => {
  printHelp();
  process.exit(0);
});

// Custom help command
program
  .command('help')
  .description('Display detailed usage instructions and examples')
  .action(() => {
    printHelp();
  });

// Encrypt command
program
  .command('encrypt')
  .description('Convert matching text files across workspace into .fan binary format')
  .option('-t, --target <ext>', 'Target extension(s) to encrypt (e.g. .txt, .md, .env)')
  .option('-d, --dir <path>', 'Workspace directory to scan', process.cwd())
  .option('-f, --file <file>', 'Specific file path to encrypt')
  .option('-k, --key <key>', 'Custom secret key for encryption')
  .option('--keep', 'Keep original plain text file after encryption')
  .option('-v, --verbose', 'Verbose log output')
  .action(async (options: EncryptOptions) => {
    const startTime = Date.now();
    printBanner();

    const { key, source: keySource } = getOrCreateKey(options.key);
    logInfo(`Key Source: ${pc.cyan(keySource)}`);

    let targetFiles: string[] = [];
    const rootDir = path.resolve(options.dir || process.cwd());

    if (options.file) {
      const singleFile = path.resolve(options.file);
      if (!fs.existsSync(singleFile)) {
        logError(options.file, 'File does not exist');
        process.exit(1);
      }
      targetFiles = [singleFile];
    } else {
      const targets = normalizeTargets(options.target);
      if (targets.length > 0) {
        logInfo(`Target Extensions: ${pc.yellow(targets.join(', '))}`);
      } else {
        logInfo(`Target: ${pc.yellow('All eligible text files')}`);
      }

      logInfo(`Scanning workspace directory: ${pc.bold(rootDir)}`);
      targetFiles = scanDirectory(rootDir, {
        mode: 'encrypt',
        targetExtensions: targets,
      });
    }

    if (targetFiles.length === 0) {
      logWarning('No matching files found for encryption.');
      process.exit(0);
    }

    logInfo(`Found ${pc.bold(targetFiles.length)} file(s) to encrypt.\n`);

    let successCount = 0;
    let failCount = 0;

    for (const filePath of targetFiles) {
      const relPath = path.relative(rootDir, filePath);
      try {
        const rawContent = fs.readFileSync(filePath);
        const encryptedBuffer = encryptFileContent(filePath, rawContent, key, relPath);

        // Formulate output .fan path
        const dirName = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        let outputPath = path.join(dirName, `${baseName}.fan`);

        // If file with same base name .fan exists and wasn't original file, append ext to avoid collision
        if (fs.existsSync(outputPath) && outputPath !== filePath) {
          outputPath = path.join(dirName, `${path.basename(filePath)}.fan`);
        }

        // Write binary .fan file
        fs.writeFileSync(outputPath, encryptedBuffer);

        // Delete original file unless --keep specified
        if (!options.keep) {
          fs.unlinkSync(filePath);
        }

        const sizeStr = `${(rawContent.length / 1024).toFixed(1)} KB → ${(encryptedBuffer.length / 1024).toFixed(1)} KB`;
        logSuccess('ENCRYPTED', relPath, `Saved as ${path.basename(outputPath)} | ${sizeStr}`);
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError(relPath, msg);
        failCount++;
      }
    }

    printSummary({
      action: 'Encrypt',
      totalFound: targetFiles.length,
      successCount,
      failCount,
      keySource,
      durationMs: Date.now() - startTime,
    });
  });

// Decrypt command
program
  .command('decrypt')
  .description('Convert all .fan files across workspace back to original text files')
  .option('-t, --target <ext>', 'Target extension filter (default: .fan)')
  .option('-d, --dir <path>', 'Workspace directory to scan', process.cwd())
  .option('-f, --file <file>', 'Specific .fan file to decrypt')
  .option('-k, --key <key>', 'Custom secret key for decryption')
  .option('-v, --verbose', 'Verbose log output')
  .action(async (options: DecryptOptions) => {
    const startTime = Date.now();
    printBanner();

    const { key, source: keySource } = getOrCreateKey(options.key);
    logInfo(`Key Source: ${pc.cyan(keySource)}`);

    let targetFiles: string[] = [];
    const rootDir = path.resolve(options.dir || process.cwd());

    if (options.file) {
      const singleFile = path.resolve(options.file);
      if (!fs.existsSync(singleFile)) {
        logError(options.file, 'File does not exist');
        process.exit(1);
      }
      targetFiles = [singleFile];
    } else {
      logInfo(`Scanning for .fan files in: ${pc.bold(rootDir)}`);
      targetFiles = scanDirectory(rootDir, {
        mode: 'decrypt',
      });
    }

    if (targetFiles.length === 0) {
      logWarning('No .fan files found to decrypt.');
      process.exit(0);
    }

    logInfo(`Found ${pc.bold(targetFiles.length)} .fan file(s) to decrypt.\n`);

    let successCount = 0;
    let failCount = 0;

    for (const fanPath of targetFiles) {
      const relPath = path.relative(rootDir, fanPath);
      try {
        const encryptedStream = fs.readFileSync(fanPath);
        const { metadata, content } = decryptFileContent(encryptedStream, key);

        const targetDir = path.dirname(fanPath);
        const restoredPath = path.join(targetDir, metadata.originalName);

        // Write restored original text file
        fs.writeFileSync(restoredPath, content);

        // Remove .fan file after successful decryption
        fs.unlinkSync(fanPath);

        const restoredRel = path.relative(rootDir, restoredPath);
        logSuccess('DECRYPTED', relPath, `Restored as ${pc.green(restoredRel)} (${(content.length / 1024).toFixed(1)} KB)`);
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError(relPath, msg);
        failCount++;
      }
    }

    printSummary({
      action: 'Decrypt',
      totalFound: targetFiles.length,
      successCount,
      failCount,
      keySource,
      durationMs: Date.now() - startTime,
    });
  });

// Status command
program
  .command('status <file>')
  .description('Inspect metadata of a .fan binary file without extracting')
  .option('-k, --key <key>', 'Custom secret key')
  .action((file: string, options: { key?: string }) => {
    printBanner();
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      logError(file, 'File does not exist');
      process.exit(1);
    }

    const { key, source: keySource } = getOrCreateKey(options.key);
    try {
      const buffer = fs.readFileSync(filePath);
      const metadata = inspectFanFile(buffer, key);

      console.log(pc.bold(pc.cyan('─── .FAN FILE METADATA ───')));
      console.log(`  ${pc.bold('File Path:')}      ${filePath}`);
      console.log(`  ${pc.bold('Original Name:')}  ${pc.green(metadata.originalName)}`);
      console.log(`  ${pc.bold('Extension:')}      ${pc.yellow(metadata.originalExt)}`);
      console.log(`  ${pc.bold('Encrypted Date:')} ${new Date(metadata.timestamp).toLocaleString()}`);
      console.log(`  ${pc.bold('Checksum:')}       ${pc.gray(metadata.checksum)}`);
      console.log(`  ${pc.bold('Format Ver:')}     ${metadata.version}`);
      console.log(`  ${pc.bold('Key Source:')}     ${pc.gray(keySource)}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(file, msg);
      process.exit(1);
    }
  });

// Key command
const keyCmd = program
  .command('key')
  .description('Display master key information or set a new key');

keyCmd
  .action(() => {
    printBanner();
    const { key, source } = getOrCreateKey();
    console.log(pc.bold(pc.cyan('─── FAN MASTER KEY CONFIG ───')));
    console.log(`  ${pc.bold('Source:')}         ${source}`);
    console.log(`  ${pc.bold('Master Key:')}     ${pc.green(key.toString('hex'))}\n`);
    console.log(`  ${pc.gray('To use this same key on another machine:')}`);
    console.log(`  $ ${pc.cyan(`fan key set ${key.toString('hex')}`)}\n`);
  });

keyCmd
  .command('set <secretOrKey>')
  .description('Set a custom passphrase or sync a master key across machines')
  .action((secretOrKey: string) => {
    printBanner();
    const filePath = setMasterKey(secretOrKey);
    const { key } = getOrCreateKey();
    console.log(pc.bold(pc.cyan('─── MASTER KEY UPDATED ───')));
    console.log(`  ${pc.bold('Saved To:')}        ${filePath}`);
    console.log(`  ${pc.bold('Active Key Hash:')} ${pc.green(key.toString('hex'))}\n`);
  });


// Fallback when no args provided
if (process.argv.length <= 2) {
  printHelp();
  process.exit(0);
}

program.parse(process.argv);
