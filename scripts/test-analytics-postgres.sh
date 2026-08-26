#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container_name="humanly-analytics-postgres-$$-$RANDOM"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --rm \
  --name "$container_name" \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_DB=humanly_analytics_test \
  --env POSTGRES_USER=humanly_analytics_test \
  --env POSTGRES_PASSWORD=humanly_analytics_test \
  postgres:15.13-alpine3.20 >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container_name" pg_isready \
    -U humanly_analytics_test -d humanly_analytics_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$container_name" pg_isready \
  -U humanly_analytics_test -d humanly_analytics_test >/dev/null 2>&1; then
  echo "Analytics PostgreSQL fixture did not become ready." >&2
  docker logs "$container_name" >&2 || true
  exit 1
fi

host_port="$(docker port "$container_name" 5432/tcp | sed 's/.*://')"
cd "$repo_root"
DATABASE_URL="postgres://humanly_analytics_test:humanly_analytics_test@127.0.0.1:${host_port}/humanly_analytics_test?options=-c%20timezone%3DAmerica%2FToronto" \
REDIS_URL=redis://127.0.0.1:1 \
JWT_SECRET=test-jwt-secret \
EMAIL_FROM=test@example.com \
  pnpm --filter @humanly/backend exec tsx \
    src/services/analytics-postgres-check.ts
