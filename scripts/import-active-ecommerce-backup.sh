#!/usr/bin/env bash
set -euo pipefail

ZIP_PATH="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$REPO_ROOT/active-ecommerce"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ -z "$ZIP_PATH" || ! -f "$ZIP_PATH" ]]; then
  echo "Usage: $0 /path/to/ecommain2.zip" >&2
  exit 1
fi

command -v unzip >/dev/null 2>&1 || { echo "unzip is required" >&2; exit 1; }

mkdir -p "$DEST"
unzip -q "$ZIP_PATH" -d "$TMP/unpacked"

# Locate the recovered Laravel application root instead of assuming the zip has no wrapper folder.
APP_ROOT=""
while IFS= read -r candidate; do
  dir="$(dirname "$candidate")"
  if [[ -f "$dir/composer.json" && -d "$dir/app" && -d "$dir/routes" && -d "$dir/resources" ]]; then
    APP_ROOT="$dir"
    break
  fi
done < <(find "$TMP/unpacked" -type f -name artisan -print)

if [[ -z "$APP_ROOT" ]]; then
  echo "Could not locate a Laravel application root inside $ZIP_PATH" >&2
  exit 1
fi

echo "Recovered Laravel root: $APP_ROOT"

# Keep the README already committed in the destination.
README_TMP=""
if [[ -f "$DEST/README.md" ]]; then
  README_TMP="$TMP/README.md"
  cp "$DEST/README.md" "$README_TMP"
fi

# Replace only the recovered backend directory. The existing React storefront is outside this folder.
find "$DEST" -mindepth 1 -maxdepth 1 ! -name README.md -exec rm -rf {} +

# Copy source while deliberately excluding secrets, runtime state and production data/artifacts.
rsync -a \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.git' \
  --exclude='storage/logs/***' \
  --exclude='storage/framework/cache/***' \
  --exclude='storage/framework/sessions/***' \
  --exclude='storage/framework/views/***' \
  --exclude='bootstrap/cache/*.php' \
  --exclude='public/logs/***' \
  --exclude='public/uploads/***' \
  --exclude='public/storage/***' \
  --exclude='*.sql' \
  --exclude='*.zip' \
  --exclude='*.tar' \
  --exclude='*.tar.gz' \
  "$APP_ROOT/" "$DEST/"

if [[ -n "$README_TMP" && -f "$README_TMP" ]]; then
  cp "$README_TMP" "$DEST/README.md"
fi

cat > "$DEST/.env.example.restoration" <<'EOF'
APP_ENV=staging
APP_DEBUG=false
APP_URL=https://staging.example.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=aurona_staging
DB_USERNAME=aurona_staging
DB_PASSWORD=CHANGE_ME

# Copy non-secret behavioral settings from the recovered private .env manually.
# Never commit production payment, mail, SMS, shipping, storage or OAuth secrets.
EOF

cat > "$DEST/.gitignore" <<'EOF'
.env
.env.*
!.env.example
!.env.example.restoration
/vendor/
/node_modules/
/public/uploads/
/public/storage/
/public/logs/
/storage/*.key
/storage/logs/*
/storage/framework/cache/*
/storage/framework/sessions/*
/storage/framework/views/*
/bootstrap/cache/*.php
*.sql
*.zip
*.tar
*.tar.gz
EOF

required=(artisan composer.json composer.lock app routes resources config database bootstrap)
missing=0
for item in "${required[@]}"; do
  if [[ ! -e "$DEST/$item" ]]; then
    echo "Missing required recovered item: $item" >&2
    missing=1
  fi
done

if [[ $missing -ne 0 ]]; then
  exit 1
fi

for expected in routes/admin.php routes/wholesale.php; do
  if [[ ! -f "$DEST/$expected" ]]; then
    echo "Warning: recovered application does not contain $expected" >&2
  fi
done

echo "Active eCommerce source imported into: $DEST"
echo "Next: inspect git diff, configure a private staging .env/database, then run the smoke checks."
