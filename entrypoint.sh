#!/bin/sh
# Gateway container entrypoint.
#
# 1. Validates that required env vars are present — fails loudly if not (PRD §18.7).
# 2. Renders nginx.conf.template → /etc/nginx/conf.d/default.conf via envsubst.
# 3. Ships snippets to /etc/nginx/snippets/ with the same env-var expansion.
# 4. Validates config with nginx -t, then exec's the CMD.
set -eu

# New API-only upstreams default to CapRover's internal service names so older
# app configs do not need to carry every upstream explicitly.
: "${BILLING_UPSTREAM:=http://srv-captain--billing}"
: "${MARKETPLACE_UPSTREAM:=http://srv-captain--marketplace-api}"
: "${PROVIDER_UPSTREAM:=http://srv-captain--provider-api}"
: "${STORAGE_UPSTREAM:=http://srv-captain--storage-api}"
: "${TURN_AUTH_UPSTREAM:=http://srv-captain--turn-auth}"
export BILLING_UPSTREAM MARKETPLACE_UPSTREAM PROVIDER_UPSTREAM STORAGE_UPSTREAM TURN_AUTH_UPSTREAM

REQUIRED_VARS="INTERNAL_SHARED_SECRET ACCOUNTS_UPSTREAM DEVELOPER_UPSTREAM MARKETPLACE_UPSTREAM PROVIDER_UPSTREAM SOURCE_UPSTREAM GRAPH_UPSTREAM TELEMETRY_UPSTREAM DELIVERY_UPSTREAM DOMAINS_UPSTREAM BILLING_UPSTREAM STORAGE_UPSTREAM"
MISSING=""
for v in $REQUIRED_VARS; do
    eval "val=\${$v:-}"
    if [ -z "$val" ]; then
        MISSING="$MISSING $v"
    fi
done
if [ -n "$MISSING" ]; then
    echo '{"level":"fatal","service":"gateway","msg":"missing required env vars","vars":"'"$MISSING"'"}' >&2
    exit 1
fi

# Render template with only the vars we explicitly reference — guard against
# envsubst eating arbitrary $vars inside the template (e.g. $remote_addr).
VARS='${INTERNAL_SHARED_SECRET} ${ACCOUNTS_UPSTREAM} ${DEVELOPER_UPSTREAM} ${MARKETPLACE_UPSTREAM} ${PROVIDER_UPSTREAM} ${SOURCE_UPSTREAM} ${GRAPH_UPSTREAM} ${TELEMETRY_UPSTREAM} ${DELIVERY_UPSTREAM} ${DOMAINS_UPSTREAM} ${BILLING_UPSTREAM} ${STORAGE_UPSTREAM} ${TURN_AUTH_UPSTREAM}'

mkdir -p /etc/nginx/snippets /etc/nginx/conf.d
envsubst "$VARS" < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Snippets go through the same env-subst pass — most don't contain any
# env refs, but running envsubst over all of them is cheap and keeps the
# logic uniform. If a new snippet lands in /snippets/, it picks up here
# without another edit.
for src in /snippets/*.conf /snippets/**/*.conf; do
    [ -f "$src" ] || continue
    rel="${src#/snippets/}"
    dst="/etc/nginx/snippets/$rel"
    mkdir -p "$(dirname "$dst")"
    envsubst "$VARS" < "$src" > "$dst"
done

nginx -t

echo '{"level":"info","service":"gateway","msg":"gateway starting","accounts":"'"$ACCOUNTS_UPSTREAM"'","developer":"'"$DEVELOPER_UPSTREAM"'","marketplace":"'"$MARKETPLACE_UPSTREAM"'","provider":"'"$PROVIDER_UPSTREAM"'","source":"'"$SOURCE_UPSTREAM"'","graph":"'"$GRAPH_UPSTREAM"'","telemetry":"'"$TELEMETRY_UPSTREAM"'","delivery":"'"$DELIVERY_UPSTREAM"'","domains":"'"$DOMAINS_UPSTREAM"'","billing":"'"$BILLING_UPSTREAM"'","storage":"'"$STORAGE_UPSTREAM"'"}'

exec "$@"
