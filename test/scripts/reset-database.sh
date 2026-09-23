#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE_FILE="$ROOT_DIR/.env.example"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to read package.json and DATABASE_URL." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required. Install PostgreSQL client tools first." >&2
  exit 1
fi

PROJECT_NAME="$(node - "$ROOT_DIR/package.json" <<'NODE'
const fs = require("fs");
const packagePath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
process.stdout.write(pkg.name || "ranger_app");
NODE
)"

DATABASE_NAME="$(node - "$PROJECT_NAME" <<'NODE'
const value = process.argv[2] || "ranger_app";
const snake = value
  .replace(/^@/, "")
  .replace(/\//g, "_")
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^a-zA-Z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();
process.stdout.write(snake || "ranger_app");
NODE
)"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE_FILE" ]]; then
    cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
    echo "Created .env from .env.example"
  else
    touch "$ENV_FILE"
  fi
fi

mkdir -p "$ROOT_DIR/packages/db"
ln -sf ../../.env "$ROOT_DIR/packages/db/.env"
echo "Linked packages/db/.env -> ../../.env"

RAW_DATABASE_URL="$(node - "$ENV_FILE" "$DATABASE_NAME" <<'NODE'
const fs = require("fs");
const [envFile, databaseName] = process.argv.slice(2);
const fallback = "postgresql://postgres:postgres@localhost:5432/" + databaseName + "?schema=public";
const text = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
const match = text.match(/^DATABASE_URL=(.*)$/m);
let value = match ? match[1].trim() : fallback;
if (
  (value.startsWith('"') && value.endsWith('"')) ||
  (value.startsWith("'") && value.endsWith("'"))
) {
  value = value.slice(1, -1);
}
process.stdout.write(value || fallback);
NODE
)"

TARGET_DATABASE_URL="$(node - "$RAW_DATABASE_URL" "$DATABASE_NAME" <<'NODE'
const [rawUrl, databaseName] = process.argv.slice(2);
const url = new URL(rawUrl);
url.pathname = "/" + databaseName;
process.stdout.write(url.toString());
NODE
)"

ADMIN_DATABASE_URL="$(node - "$TARGET_DATABASE_URL" <<'NODE'
const url = new URL(process.argv[2]);
url.pathname = "/postgres";
url.search = "";
process.stdout.write(url.toString());
NODE
)"

echo "Project name: $PROJECT_NAME"
echo "Database name: $DATABASE_NAME"
echo "Postgres server: $ADMIN_DATABASE_URL"
echo
echo "This will terminate active connections, drop database '$DATABASE_NAME' if it exists, and create it again."
read -r -p "Continue? Type 'yes' to confirm: " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
  echo "Cancelled."
  exit 1
fi

psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v database_name="$DATABASE_NAME" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'database_name'
  AND pid <> pg_backend_pid();

SELECT 'DROP DATABASE IF EXISTS ' || quote_ident(:'database_name') || ';' \gexec
SELECT 'CREATE DATABASE ' || quote_ident(:'database_name') || ';' \gexec
SQL

node - "$ENV_FILE" "$TARGET_DATABASE_URL" <<'NODE'
const fs = require("fs");
const [envFile, databaseUrl] = process.argv.slice(2);
const line = 'DATABASE_URL="' + databaseUrl + '"';
let text = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";

if (/^DATABASE_URL=.*$/m.test(text)) {
  text = text.replace(/^DATABASE_URL=.*$/m, line);
} else {
  text = text.replace(/\s*$/u, "");
  text += (text ? "\n" : "") + line + "\n";
}

fs.writeFileSync(envFile, text.endsWith("\n") ? text : text + "\n");
NODE

echo
echo "Database '$DATABASE_NAME' is ready."
echo "Updated DATABASE_URL in the root .env source of truth."
echo "Next: pnpm db:push && pnpm db:seed"
