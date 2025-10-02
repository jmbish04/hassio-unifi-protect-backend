#!/bin/bash
#
# Smart repair script for Zsh, NVM, and Cloudflare Wrangler on macOS.
#
# This script will:
# 1. Check for common .zshrc issues that cause shell recursion with nvm.
# 2. If issues are found, it creates a backup and patches the .zshrc file.
# 3. Checks if the globally installed Cloudflare Wrangler is up-to-date.
# 4. If Wrangler is outdated, it uninstalls it from npm and pnpm, then
#    reinstalls the latest version globally with both package managers.

# --- Setup ---
set -e # Exit immediately if a command exits with a non-zero status.
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ZSHRC_FILE="$HOME/.zshrc"
ZSHRC_BACKUP_FILE="$HOME/.zshrc.bak.$(date +%s)"

# --- Helper Functions ---
info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# --- 1. Diagnose and Repair .zshrc ---
info "Auditing shell configuration in $ZSHRC_FILE..."

# Check for the two known issues: oh-my-zsh npm plugin and nvm lazy-load functions
NEEDS_REPAIR=false
if grep -q 'npm()  { load_nvm; command npm "$@"; }' "$ZSHRC_FILE"; then
    warn "Problematic nvm lazy-load function found."
    NEEDS_REPAIR=true
fi

# Use sed to isolate the plugins array and check for the npm plugin
if sed -n '/plugins=(/,/)/p' "$ZSHRC_FILE" | grep -q '^[[:space:]]*npm[[:space:]]*$'; then
    warn "Conflicting 'oh-my-zsh' npm plugin found."
    NEEDS_REPAIR=true
fi

if [ "$NEEDS_REPAIR" = true ]; then
    info "Attempting to repair .zshrc..."
    # Create a backup
    cp "$ZSHRC_FILE" "$ZSHRC_BACKUP_FILE"
    success "Backup created at $ZSHRC_BACKUP_FILE"

    # Fix 1: Comment out the npm plugin
    sed -i '' '/plugins=(/,/)/s/^[[:space:]]*npm[[:space:]]*$/  # & # Disabled by repair script/' "$ZSHRC_FILE"

    # Fix 2: Replace the entire multi-line lazy-load block
    # Using awk for a more reliable multi-line replacement
    awk '
      BEGIN {
        in_block=0;
        block_start_pattern = "# ---- 6) Node/nvm — lazy load";
        block_end_pattern = "npx\\(\\)  { load_nvm; command npx \"\\$@\"; }";
        replacement = "# ---- 6) Node/nvm — lazy load (fast shells, correct arch) ----\nexport NVM_DIR=\"$HOME/.nvm\"\n[ -s \"\\$NVM_DIR/nvm.sh\" ] && \\\. \"\\$NVM_DIR/nvm.sh\" # This loads nvm";
      }
      $0 ~ block_start_pattern {
        in_block=1;
        print replacement;
        next;
      }
      $0 ~ block_end_pattern {
        in_block=0;
        next;
      }
      !in_block {
        print;
      }
    ' "$ZSHRC_FILE" > "$ZSHRC_FILE.tmp" && mv "$ZSHRC_FILE.tmp" "$ZSHRC_FILE"

    success ".zshrc has been patched."
    warn "You MUST open a new terminal or run 'source ~/.zshrc' for changes to take effect."
else
    success "Your .zshrc configuration appears to be correct."
fi

echo "" # Newline for spacing

# --- 2. Check and Update Wrangler ---
info "Checking Cloudflare Wrangler version..."

LATEST_VERSION=$(npm view wrangler version)
if [ -z "$LATEST_VERSION" ]; then
    warn "Could not fetch the latest Wrangler version from npm."
    exit 1
fi
info "Latest Wrangler version on npm is: $LATEST_VERSION"

CURRENT_VERSION=$(wrangler --version 2>/dev/null | awk '{print $2}' || echo "not_installed")

if [ "$CURRENT_VERSION" = "not_installed" ]; then
    warn "Wrangler is not installed. Installing latest version..."
    npm install -g wrangler
    pnpm add -g wrangler
    success "Wrangler $LATEST_VERSION installed."
elif [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
    warn "Your Wrangler version ($CURRENT_VERSION) is outdated. Updating to $LATEST_VERSION..."
    info "Uninstalling old versions from npm and pnpm to ensure a clean install..."
    npm uninstall -g wrangler || true
    pnpm remove -g wrangler || true
    
    info "Installing latest version with npm and pnpm..."
    npm install -g wrangler
    pnpm add -g wrangler
    success "Wrangler has been updated to $LATEST_VERSION."
else
    success "Your Wrangler version ($CURRENT_VERSION) is already up-to-date."
fi

echo "" # Newline for spacing
info "Verification complete. Your environment is ready."
