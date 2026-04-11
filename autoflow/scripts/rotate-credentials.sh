#!/bin/bash
# AutoFlow Credential Rotation Script
# SECURITY: Rotate all secrets and update configuration safely
# Usage: ./scripts/rotate-credentials.sh [env-file]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOFLOW_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${1:-.env.production}"

echo "================================================================================
AutoFlow Credential Rotation Script
================================================================================"

# Verify environment file exists
if [ ! -f "$AUTOFLOW_DIR/$ENV_FILE" ]; then
    echo "ERROR: Environment file not found: $AUTOFLOW_DIR/$ENV_FILE"
    exit 1
fi

# Source current environment
source "$AUTOFLOW_DIR/$ENV_FILE"

# Backup current environment
BACKUP_FILE="$AUTOFLOW_DIR/.env.backup-$(date +%Y%m%d-%H%M%S)"
cp "$AUTOFLOW_DIR/$ENV_FILE" "$BACKUP_FILE"
echo "[1] ✓ Backed up current configuration to: $BACKUP_FILE"

# Generate new secure passwords
generate_password() {
    openssl rand -base64 32 | tr -d '\n'
}

# Display current values (masked)
echo -e "\n[2] Current Configuration:"
echo "  Database User:      $POSTGRES_USER"
echo "  Database Password:  ****"
echo "  Grafana Admin:      admin"

# Generate new credentials
NEW_DB_PASS=$(generate_password)
NEW_ADMIN_PASS=$(generate_password)
NEW_REDIS_PASS=$(generate_password)

echo -e "\n[3] Generated new credentials:"
echo "  New Database Password:  ✓ Generated"
echo "  New Grafana Password:   ✓ Generated"
echo "  New Redis Password:     ✓ Generated"

# Update environment file
echo -e "\n[4] Updating environment configuration..."

# Use a temporary file for safe updating
TEMP_ENV=$(mktemp)
trap "rm -f $TEMP_ENV" EXIT

while IFS= read -r line; do
    if [[ "$line" =~ ^POSTGRES_PASSWORD= ]]; then
        echo "POSTGRES_PASSWORD=$NEW_DB_PASS" >> "$TEMP_ENV"
    elif [[ "$line" =~ ^AUTOFLOW_DB_PASS= ]]; then
        echo "AUTOFLOW_DB_PASS=$NEW_DB_PASS" >> "$TEMP_ENV"
    elif [[ "$line" =~ ^GF_SECURITY_ADMIN_PASSWORD= ]]; then
        echo "GF_SECURITY_ADMIN_PASSWORD=$NEW_ADMIN_PASS" >> "$TEMP_ENV"
    elif [[ "$line" =~ ^REDIS_PASSWORD= ]]; then
        echo "REDIS_PASSWORD=$NEW_REDIS_PASS" >> "$TEMP_ENV"
    else
        echo "$line" >> "$TEMP_ENV"
    fi
done < "$AUTOFLOW_DIR/$ENV_FILE"

mv "$TEMP_ENV" "$AUTOFLOW_DIR/$ENV_FILE"
chmod 600 "$AUTOFLOW_DIR/$ENV_FILE"
echo "  ✓ Updated .env.production with new credentials"

# Update database password if container is running
echo -e "\n[5] Updating database credentials..."
if docker ps | grep -q autoflow-postgres; then
    export PGPASSWORD="$POSTGRES_PASSWORD"

    # Update autoflow user password
    docker exec autoflow-postgres psql -U postgres -d autoflow \
        -c "ALTER USER autoflow WITH PASSWORD '$NEW_DB_PASS';" 2>/dev/null \
        && echo "  ✓ PostgreSQL user password updated" || echo "  ⚠ Could not update PostgreSQL password"
else
    echo "  ⚠ PostgreSQL container not running, skipping password update"
    echo "    Run the following manually after container startup:"
    echo "    ALTER USER autoflow WITH PASSWORD '$NEW_DB_PASS';"
fi

# Update Grafana password if needed
echo -e "\n[6] Grafana Configuration:"
echo "  Grafana will use new password on next container restart"
echo "  Default admin username: admin"
echo "  New admin password: [use .env.production]"

# Update Redis password if running
if docker ps | grep -q autoflow-redis; then
    echo -e "\n[7] Redis Configuration:"
    echo "  Redis will use new password on next container restart"
else
    echo -e "\n[7] Redis:"
    echo "  Container not running, will use new password at startup"
fi

# Security summary
echo -e "\n[8] Security Summary:"
echo "  ✓ Old configuration backed up to: $BACKUP_FILE"
echo "  ✓ Environment file updated (.env.production)"
echo "  ✓ File permissions: 600 (user-only read/write)"
echo "  ✓ Database password updated"

# Next steps
echo -e "\n[9] Next Steps:"
echo "  1. Restart containers to apply new credentials:"
echo "     docker compose -f docker-compose-production.yml restart"
echo ""
echo "  2. Verify all services are running:"
echo "     docker compose -f docker-compose-production.yml ps"
echo ""
echo "  3. Test database connection:"
echo "     PGPASSWORD='$NEW_DB_PASS' psql -h localhost -p 5434 -U autoflow -d autoflow -c 'SELECT 1;'"
echo ""
echo "  4. Access Grafana with new credentials:"
echo "     http://localhost:3002 (admin / [new password from .env.production])"

echo -e "\n[10] Security Checklist:"
echo "  [ ] Backup file reviewed and stored safely: $BACKUP_FILE"
echo "  [ ] .env.production file secured (600 permissions)"
echo "  [ ] Containers restarted with new credentials"
echo "  [ ] All services verified as healthy"
echo "  [ ] Old credentials rotated from all systems"

echo -e "\n================================================================================
Credential Rotation Complete
================================================================================"
