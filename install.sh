#!/usr/bin/env bash
set -euo pipefail

BIN_NAME="vaer"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
BIN_PATH="${BUILD_DIR}/${BIN_NAME}"

if [[ ! -x "${BIN_PATH}" ]]; then
  echo "Binary not found at ${BIN_PATH}. Build first:"
  echo "  cmake -S . -B build"
  echo "  cmake --build build"
  exit 1
fi

if [[ $EUID -eq 0 ]]; then
  DEST_DIR="/usr/local/bin"
else
  DEST_DIR="${HOME}/.local/bin"
  mkdir -p "${DEST_DIR}"
fi

install -m 0755 "${BIN_PATH}" "${DEST_DIR}/${BIN_NAME}"

echo "Installed ${BIN_NAME} to ${DEST_DIR}/${BIN_NAME}"
if [[ "${DEST_DIR}" == "${HOME}/.local/bin" ]]; then
  if ! echo "${PATH}" | tr ':' '\n' | grep -qx "${DEST_DIR}"; then
    echo "Add this to your shell profile to use it everywhere:"
    echo "  export PATH=\"${DEST_DIR}:\$PATH\""
  fi
fi
