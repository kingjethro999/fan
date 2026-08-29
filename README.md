# 🪭 FAN CLI (`.fan` Binary Encrypter)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v24+-green.svg)](https://nodejs.org/)
[![Security](https://img.shields.io/badge/Encryption-AES--256--GCM-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-ISC-orange.svg)]()

```
  ██████╗  █████╗ ███╗   ██╗
  ██╔════╝ ██╔══██╗████╗  ██║
  █████╗   ███████║██╔██╗ ██║
  ██╔══╝   ██╔══██║██║╚██╗██║
  ██║      ██║  ██║██║ ╚████║
  ╚═╝      ╚═╝  ╚═╝╚═╝  ╚═══╝  v1.0.0 — Binary File Encrypter
```

**`fan`** is a high-performance command-line utility built with TypeScript designed to encrypt text files (`.txt`, `.md`, `.env`, configuration files, etc.) into an **un-transcribable binary format (`.fan`)** across your workspace, and convert them back to their exact original state on demand.

---

## 💡 Why `fan`?

When managing projects, sensitive files like API keys, secrets (`.env`), documentation (`.md`), or private raw text (`.txt`) can easily be leaked or transcribed by Version Control Systems like Git.

When files are converted to `.fan`:
1. **Git Binary Recognition**: `git` recognizes `.fan` as a binary data blob. `git diff` cannot transcribe or display plaintext content.
2. **Zero Plaintext Residuals**: Original file contents, file extensions, and filenames are encrypted inside an authenticated binary container.
3. **Automated Restoration**: The `fan decrypt` command scans your project, reads the embedded binary metadata, and restores every file to its exact original name and content.

---

## ⚡ Key Features

- 🔐 **AES-256-GCM Authenticated Encryption**: Military-grade encryption using PBKDF2 key derivation (50,000 iterations) with random 16-byte salts and 12-byte initialization vectors (IV).
- 🏷 **Metadata Container Spec (`FAN1`)**: Binary magic header `FAN1` (`0x46 0x41 0x4E 0x31`) guarantees format validation, tamper detection, and exact filename/extension restoration.
- 🛡 **SHA-256 Integrity Verification**: Every decrypted file is checked against a cryptographic hash to ensure zero corruption or tampering.
- 🚫 **Smart Workspace Exclusion Rules**: Automatically skips standard dependency and build directories (`node_modules`, `venv`, `.venv`, `vendor`, `vendors`, `dist`, `build`, `.git`, `.next`, `coverage`, `.cache`, etc.).
- 🔑 **Flexible Key Management**: Auto-generates a secure master key stored at `~/.fan/master.key` (chmod 600) with support for `FAN_KEY` environment variables and `--key` CLI overrides.

---

## ⚡ Quick 1-Line Installation

Install `fan` globally on any Linux/macOS machine with Node.js:

```bash
curl -fsSL https://raw.githubusercontent.com/kingjethro999/fan/main/install.sh | bash
```

---

## ⚙️ Manual Installation & Build

If you cloned the source repository locally:

```bash
# Install dependencies & build
npm install
npm run build

# Install globally
npm install -g .
```

Verify global installation:
```bash
fan help
```


---

## 📖 Command Reference & Examples

### 1. `fan help`
Displays the interactive terminal help menu with commands, flags, and usage examples.

```bash
fan help
```

---

### 2. `fan encrypt`
Scans your workspace directory and converts target text files to `.fan` binary files.

```bash
# Convert every .txt file in the workspace to .fan
fan encrypt --target .txt

# Convert multiple target extensions (e.g. .md and .env) to .fan
fan encrypt -t .md,.env

# Encrypt all eligible text files in the workspace
fan encrypt

# Encrypt a single specific file
fan encrypt --file secret.txt

# Keep original file after encryption (do not delete plaintext)
fan encrypt --target .txt --keep

# Encrypt using a custom secret key
fan encrypt --target .txt --key "MySuperSecretPassphrase"
```

---

### 3. `fan decrypt`
Scans the workspace for all `.fan` files, decrypts them back into their original text files (`.txt`, `.md`, `.env`), and restores exact original content.

```bash
# Decrypt all .fan files across the workspace
fan decrypt

# Decrypt a specific .fan file
fan decrypt --file config.fan

# Decrypt using a custom key
fan decrypt --key "MySuperSecretPassphrase"
```

---

### 4. `fan status <file.fan>`
Inspects `.fan` binary metadata (original name, extension, encryption timestamp, SHA-256 checksum) without extracting the file.

```bash
fan status sample1.fan
```

*Example Output:*
```
─── .FAN FILE METADATA ───
  File Path:      /workspace/sample1.fan
  Original Name:  sample1.txt
  Extension:      .txt
  Encrypted Date: 8/29/2026, 10:42:55 AM
  Checksum:       3c27f84e1bb7427ffb3557ae67237ae245875081f5e4d9fe226061ab7540b3dc
  Format Ver:     1.0.0
  Key Source:     Master Key (/home/user/.fan/master.key)
```

---

### 5. `fan key`
Displays current master key details, or sets a shared key across machines.

```bash
# View active master key & export command for other PCs
fan key

# Sync master key from another machine or set a shared secret passphrase
fan key set <yourSecretOrMasterKey>
```

---

## 💻 Multi-Machine Decryption & Syncing

When you encrypt a file on **Machine A**, `fan` uses Machine A's master key. If you pull `.fan` files onto **Machine B**, running `fan decrypt` requires **Machine B to have the same key**:

1. **Option 1 (Command-line flag)**:
   ```bash
   fan decrypt --key "mySecretPassphrase"
   ```
2. **Option 2 (Sync Key once using `fan key set`)**:
   On Machine A, run:
   ```bash
   fan key
   ```
   Copy the key output, then on Machine B run:
   ```bash
   fan key set <copiedKey>
   ```
   Now Machine B can run `fan decrypt` seamlessly!


---

## 📐 Binary Format Specification (`FAN1`)

Every `.fan` file follows a strict binary layout:

```
+-------------------+-------------------+-------------------+-------------------+------------------------+
| Magic (4 Bytes)   | Salt (16 Bytes)   | IV (12 Bytes)     | Auth Tag (16B)    | Encrypted Payload      |
| "FAN1" (0x46414E31| PBKDF2 Salt       | AES-256-GCM IV    | GCM Auth Tag      | AES-GCM Cipher Stream  |
+-------------------+-------------------+-------------------+-------------------+------------------------+
```

### Encrypted Payload Envelope Structure:
```
+-------------------------+----------------------------------+----------------------------------+
| Meta Len (4 Bytes BE)   | JSON Metadata Header (UTF-8)     | Original Raw File Bytes Buffer   |
+-------------------------+----------------------------------+----------------------------------+
```

---

## 🛠 Project Architecture

```
fan/
├── src/
│   ├── cli.ts          # Commander CLI entry point & command definitions
│   ├── crypto.ts       # FAN1 binary encoder/decoder, AES-256-GCM cipher logic
│   ├── keyManager.ts   # Master key resolver (~/.fan/master.key, env, CLI flag)
│   ├── scanner.ts      # Recursive file scanner with directory exclusion rules
│   ├── types.ts        # TypeScript interfaces and type definitions
│   └── ui.ts           # Terminal aesthetics, banners, and formatted output
├── dist/               # Compiled executable ES module bundle (cli.js)
├── tsup.config.ts      # tsup bundler configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Package configuration & global binary executable bin script
```

---

## 🧪 Tech Stack

- **Language**: TypeScript (ES2022)
- **Runtime**: Node.js (v18+)
- **Bundler**: `tsup`
- **CLI Framework**: `commander`
- **Terminal Styling**: `picocolors`
- **Cryptography Engine**: Node.js Native `crypto` (AES-256-GCM, PBKDF2, SHA-256)

---

## 📄 License

ISC License — Built with ❤️ for secure, seamless file encryption.
