#!/usr/bin/env bash
# Uploads dist/ to the Turbify subdomain's document root over explicit FTPS (DESIGN.md §12).
# SFTP (port 22) is closed on Turbify, and the TLS certificate names cpanel292.turbify.biz.
#
#   ALIGN_FTP_DIR=/align.itsallonesong.com npm run deploy:web            # build + upload (asks for the FTP password)
#   ALIGN_FTP_DIR=/align.itsallonesong.com scripts/deploy-turbify.sh --dry-run
#   scripts/deploy-turbify.sh --ls [dir]                                 # list folders, to find the docroot
#
# The password is never stored: lftp prompts for it. Only the assets/ folder is mirrored with --delete,
# so a wrong ALIGN_FTP_DIR can't wipe anything outside the app.
set -euo pipefail

HOST="${ALIGN_FTP_HOST:-cpanel292.turbify.biz}"
USER_NAME="${ALIGN_FTP_USER:-sjnelson@itsallonesong.com}"
DIR="${ALIGN_FTP_DIR:-}"
DRY=""
[[ "${1:-}" == "--dry-run" ]] && DRY="--dry-run"

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--ls" ]]; then
  read -rsp "FTP password for $USER_NAME: " LFTP_PASSWORD
  echo
  export LFTP_PASSWORD
  lftp --env-password -u "$USER_NAME" -e "set ftp:ssl-force true; set ftp:ssl-protect-data true; pwd; cls -l ${2:-/}; bye" "$HOST"
  exit
fi

if [[ -z "$DIR" || "$DIR" == "/" ]]; then
  echo "Set ALIGN_FTP_DIR to the subdomain's document root (relative to the FTP login root), e.g. /align.itsallonesong.com" >&2
  exit 1
fi
if [[ ! -f dist/index.html ]]; then
  echo "dist/ is missing: run npm run build first." >&2
  exit 1
fi
if grep -q "demo-align" dist/assets/*.js; then
  echo "dist/ was built against the emulator config. Create .env.production.local (see .env.example) and rebuild." >&2
  exit 1
fi

echo "Uploading dist/ to ftp://$USER_NAME@$HOST$DIR ${DRY:+(dry run)}"
# No terminal to type into (e.g. run from an editor or agent): say so instead of exiting silently.
if ! read -rsp "FTP password for $USER_NAME: " LFTP_PASSWORD || [[ -z "$LFTP_PASSWORD" ]]; then
  echo
  echo "No password entered, so nothing was uploaded. Run this in a terminal where you can type the password." >&2
  exit 1
fi
echo
export LFTP_PASSWORD

if [[ -n "$DRY" ]]; then
  WRITE_CMDS="echo (dry run: would create $DIR/assets and upload index.html)"
else
  WRITE_CMDS="mkdir -p -f \"$DIR/assets\""
  PUT_INDEX="put -O \"$DIR\" dist/index.html"
fi

# Assets are content-hashed: upload new ones first, then index.html, then prune old assets.
lftp --env-password -u "$USER_NAME" "$HOST" <<EOF
set ftp:ssl-force true
set ftp:ssl-protect-data true
set ssl:verify-certificate true
set net:max-retries 2
$WRITE_CMDS
mirror -R $DRY --verbose --no-perms --exclude-glob index.html dist/ "$DIR"
${PUT_INDEX:-}
mirror -R $DRY --verbose --no-perms --delete dist/assets "$DIR/assets"
bye
EOF
echo "Done: https://align.itsallonesong.com"
