#!/usr/bin/env bash
# Base de développement (calendar_dev), séparée de celle de la production.
#
#   scripts/dev-db.sh create   crée la base vide et donne les droits à l'utilisateur de l'application
#   scripts/dev-db.sh copy     remplace son contenu par une copie de la base de production
#
# Le serveur de développement (service backend) crée les tables au démarrage s'il les trouve absentes.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] && set -a && . ./.env && set +a
PROD_DB="${DB_NAME:-calendar}"
DEV_DB="${DEV_DB_NAME:-calendar_dev}"
APP_USER="${DB_USER:-calendar}"

if [ "$PROD_DB" = "$DEV_DB" ]; then
  echo "DEV_DB_NAME doit différer de DB_NAME ($PROD_DB)." >&2
  exit 1
fi

# Commande MySQL en root dans le conteneur db (mot de passe pris dans son environnement).
root_mysql() { docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$@" 2>/dev/null' -- "$@"; }

create() {
  root_mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`$DEV_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`$DEV_DB\`.* TO '$APP_USER'@'%';
SQL
  echo "Base « $DEV_DB » prête (utilisateur « $APP_USER »)."
}

copy() {
  create
  echo "Copie de « $PROD_DB » vers « $DEV_DB »…"
  root_mysql -e "DROP DATABASE \`$DEV_DB\`; CREATE DATABASE \`$DEV_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  docker compose exec -T db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --no-tablespaces "$1" 2>/dev/null' -- "$PROD_DB" \
    | root_mysql "$DEV_DB"
  echo "Copie terminée. Redémarrez le serveur de développement : docker compose restart backend"
}

case "${1:-}" in
  create) create ;;
  copy) copy ;;
  *) echo "Usage : scripts/dev-db.sh create|copy" >&2; exit 1 ;;
esac
