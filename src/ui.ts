import pc from 'picocolors';

export function printBanner() {
  console.log(
    pc.bold(
      pc.cyan(
        `\n  ██████╗  █████╗ ███╗   ██╗\n  ██╔════╝ ██╔══██╗████╗  ██║\n  █████╗   ███████║██╔██╗ ██║\n  ██╔══╝   ██╔══██║██║╚██╗██║\n  ██║      ██║  ██║██║ ╚████║\n  ╚═╝      ╚═╝  ╚═╝╚═╝  ╚═══╝`
      )
    ) + pc.gray('  v1.0.0 — Binary File Encrypter\n')
  );
}

export function printHelp() {
  printBanner();
  console.log(
    ` ${pc.bold(pc.underline('USAGE:'))}
   $ ${pc.cyan('fan')} ${pc.green('<command>')} ${pc.yellow('[options]')}

 ${pc.bold(pc.underline('COMMANDS:'))}
   ${pc.green('encrypt')}               Encrypt matching text files into un-transcribable ${pc.cyan('.fan')} binary format
   ${pc.green('decrypt')}               Decrypt all ${pc.cyan('.fan')} files back to their original text format
   ${pc.green('status')} ${pc.yellow('<file>')}         Inspect metadata of a ${pc.cyan('.fan')} file without modifying it
   ${pc.green('key')}                   Display active master key & sync instructions
   ${pc.green('key set')} ${pc.yellow('<key>')}       Set or sync a master key across devices
   ${pc.green('help')}                  Show this interactive help menu

 ${pc.bold(pc.underline('OPTIONS:'))}
   ${pc.yellow('-t, --target <ext>')}   File extension(s) to target (e.g. ${pc.bold('.txt')}, ${pc.bold('.md')}, ${pc.bold('.env')}, or ${pc.bold('.txt,.md')})
   ${pc.yellow('-d, --dir <path>')}     Target directory to scan (default: current workspace)
   ${pc.yellow('-f, --file <file>')}    Process a single file directly
   ${pc.yellow('-k, --key <key>')}      Custom secret key for encryption/decryption
   ${pc.yellow('--keep')}               Retain original file during encryption (do not delete original)
   ${pc.yellow('-v, --verbose')}        Show detailed debug output

 ${pc.bold(pc.underline('DEFAULT EXCLUSIONS (ALWAYS SKIPPED):'))}
   ${pc.gray('node_modules, venv, .venv, vendor, vendors, dist, build, .git, .next, coverage, target')}

 ${pc.bold(pc.underline('EXAMPLES:'))}
   ${pc.gray('# Convert every .txt file in workspace to .fan')}
   $ ${pc.cyan('fan encrypt --target .txt')}

   ${pc.gray('# Convert every .md and .env file in workspace to .fan')}
   $ ${pc.cyan('fan encrypt -t .md,.env')}

   ${pc.gray('# Decrypt every .fan file back to original file formats')}
   $ ${pc.cyan('fan decrypt')}

   ${pc.gray('# View your master key to copy to another device')}
   $ ${pc.cyan('fan key')}

   ${pc.gray('# Set master key on a second device to decrypt synced files')}
   $ ${pc.cyan('fan key set <copiedMasterKey>')}
`
  );
}

export function logSuccess(action: string, file: string, detail?: string) {
  const badge = action === 'ENCRYPTED' ? pc.bgCyan(pc.black(' ENCRYPTED ')) : pc.bgGreen(pc.black(' DECRYPTED '));
  console.log(` ${badge} ${pc.bold(file)}${detail ? pc.gray(` (${detail})`) : ''}`);
}

export function logError(file: string, error: string) {
  const badge = pc.bgRed(pc.white(' ERROR '));
  console.log(` ${badge} ${pc.bold(file)}: ${pc.red(error)}`);
}

export function logInfo(message: string) {
  console.log(` ${pc.blue('ℹ')} ${message}`);
}

export function logWarning(message: string) {
  console.log(` ${pc.yellow('⚠')} ${message}`);
}

export function printSummary(stats: {
  action: 'Encrypt' | 'Decrypt';
  totalFound: number;
  successCount: number;
  failCount: number;
  keySource: string;
  durationMs: number;
}) {
  console.log('\n' + pc.bold(pc.cyan('─── OPERATION SUMMARY ───')));
  console.log(`  ${pc.bold('Action:')}         ${stats.action}`);
  console.log(`  ${pc.bold('Files Processed:')} ${pc.green(stats.successCount)} / ${stats.totalFound}`);
  if (stats.failCount > 0) {
    console.log(`  ${pc.bold('Failed Files:')}    ${pc.red(stats.failCount)}`);
  }
  console.log(`  ${pc.bold('Key Source:')}      ${pc.gray(stats.keySource)}`);
  console.log(`  ${pc.bold('Duration:')}        ${pc.gray(`${stats.durationMs}ms`)}\n`);
}
