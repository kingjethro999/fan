#!/usr/bin/env bash

set -e

# ANSI Color Codes
BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${CYAN}${BOLD}"
echo "  ██████╗  █████╗ ███╗   ██╗"
echo "  ██╔════╝ ██╔══██╗████╗  ██║"
echo "  █████╗   ███████║██╔██╗ ██║"
echo "  ██╔══╝   ██╔══██║██║╚██╗██║"
echo "  ██║      ██║  ██║██║ ╚████║"
echo "  ╚═╝      ╚═╝  ╚═╝╚═╝  ╚═══╝  Global Installer"
echo -e "${RESET}"

# 1. Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is required but not installed on this system.${RESET}"
    echo -e "Please install Node.js (v18 or higher) from https://nodejs.org/ and try again."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js version $(node -v) detected. Node.js v18 or higher is recommended.${RESET}"
fi

# 2. Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is required but not installed on this system.${RESET}"
    exit 1
fi

REPO_URL="https://github.com/kingjethro999/fan.git"
TEMP_DIR="$HOME/.fan-install-tmp"

# 3. Determine if running inside repo directory or remote curl
if [ -f "package.json" ] && grep -q '"name": "fan-cli"' package.json 2>/dev/null; then
    echo -e "${GREEN}ℹ Installing from local source repository...${RESET}"
    BUILD_DIR="$(pwd)"
else
    echo -e "${GREEN}ℹ Downloading fan repository from GitHub (${REPO_URL})...${RESET}"
    if ! command -v git &> /dev/null; then
        echo -e "${RED}Error: git is required to clone the repository.${RESET}"
        exit 1
    fi
    rm -rf "$TEMP_DIR"
    git clone --depth 1 "$REPO_URL" "$TEMP_DIR"
    BUILD_DIR="$TEMP_DIR"
fi

cd "$BUILD_DIR"

echo -e "${CYAN}ℹ Installing dependencies...${RESET}"
npm install --quiet

echo -e "${CYAN}ℹ Building TypeScript binary bundle...${RESET}"
npm run build

echo -e "${CYAN}ℹ Installing fan CLI globally...${RESET}"
if command -v sudo &> /dev/null && [ "$(id -u)" -ne 0 ] && [ ! -w "$(npm config get prefix)/bin" ]; then
    echo -e "${YELLOW}Notice: Requesting sudo permissions for global npm installation...${RESET}"
    sudo npm install -g .
else
    npm install -g .
fi

# Cleanup temp dir if created
if [ "$BUILD_DIR" = "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
fi

echo -e "\n${GREEN}${BOLD}✔ Successfully installed fan CLI globally!${RESET}\n"
echo -e "Try running:"
echo -e "  ${CYAN}$ fan help${RESET}"
echo -e "  ${CYAN}$ fan encrypt --target .txt${RESET}"
echo -e "  ${CYAN}$ fan decrypt${RESET}\n"