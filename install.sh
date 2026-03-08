#!/usr/bin/env bash
# clean-my-agent installer
#
# What it does:
#   1. Symlinks the CLI to ~/.local/bin/ (or /usr/local/bin/)
#   2. Installs the OpenCode plugin (if OpenCode is detected)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="$SCRIPT_DIR/clean-my-agent"
PLUGIN_SRC="$SCRIPT_DIR/plugins/opencode.js"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

info()    { printf "  ${BLUE}ℹ${NC}  %b\n" "$*"; }
success() { printf "  ${GREEN}✓${NC}  %b\n" "$*"; }
warn()    { printf "  ${YELLOW}!${NC}  %b\n" "$*"; }

printf "\n${BOLD}  clean-my-agent installer${NC}\n\n"

# ─── Step 1: Install CLI ────────────────────────────────────────────────

chmod +x "$CLI"

# Prefer ~/.local/bin, fall back to /usr/local/bin
BIN_DIR="$HOME/.local/bin"
if [ ! -d "$BIN_DIR" ]; then
  mkdir -p "$BIN_DIR"
  warn "Created $BIN_DIR — make sure it's in your \$PATH"
fi

ln -sf "$CLI" "$BIN_DIR/clean-my-agent"
success "CLI installed: ${DIM}$BIN_DIR/clean-my-agent → $CLI${NC}"

# Check PATH
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$BIN_DIR"; then
  warn "$BIN_DIR is not in your \$PATH"
  info "Add to your shell config:  ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
fi

# ─── Step 2: Install OpenCode Plugin ────────────────────────────────────

PLUGIN_DIR="$HOME/.config/opencode/plugins"

if [ -d "$HOME/.config/opencode" ]; then
  mkdir -p "$PLUGIN_DIR"
  cp "$PLUGIN_SRC" "$PLUGIN_DIR/cleanup-orphans.js"
  success "OpenCode plugin installed: ${DIM}$PLUGIN_DIR/cleanup-orphans.js${NC}"
  info "Plugin auto-cleans orphans after each conversation."
else
  info "OpenCode not detected — skipping plugin installation."
  info "To install later: ${BOLD}cp $PLUGIN_SRC ~/.config/opencode/plugins/cleanup-orphans.js${NC}"
fi

# ─── Done ────────────────────────────────────────────────────────────────

printf "\n${BOLD}  Done!${NC} Try it:\n"
printf "\n"
printf "    ${CYAN}clean-my-agent scan${NC}      # Preview orphan processes\n"
printf "    ${CYAN}clean-my-agent clean${NC}     # Kill orphan processes\n"
printf "    ${CYAN}clean-my-agent guard${NC}     # Auto-clean daemon\n"
printf "\n"
