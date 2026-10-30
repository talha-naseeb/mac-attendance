#!/bin/sh
# Installs the versioned MacqHR hooks into .git/hooks without changing git config.
set -e

ROOT=$(git rev-parse --show-toplevel)
HOOKS_DIR="$ROOT/.git/hooks"

mkdir -p "$HOOKS_DIR"
cp "$ROOT/.githooks/pre-push" "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"

echo "Installed pre-push gate at $HOOKS_DIR/pre-push"
echo "It requires npm run verify:all and an APPROVED gate matching the pushed commit."
