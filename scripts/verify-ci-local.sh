#!/usr/bin/env bash
# shellcheck shell=bash
#
# scripts/verify-ci-local.sh — local execution of the exact CI verification gate.
#
# ALL dotnet/npx commands execute inside Docker containers.
# The only host-side requirements are: docker CLI, git, curl, id, uname.
#
# Stages:
#   1. Format check   (dotnet format --verify-no-changes)  — mcr.microsoft.com/dotnet/sdk:8.0
#   2. Build          (dotnet build Release)                — mcr.microsoft.com/dotnet/sdk:8.0
#   3. Fast tests     (UnitTests + ArchitectureTests)       — mcr.microsoft.com/dotnet/sdk:8.0
#   4. Integration    (Testcontainers MySQL)                — mcr.microsoft.com/dotnet/sdk:8.0 + Docker socket
#   5. Web build      (Angular production image)            — docker build (host daemon)
#   6. OpenAPI drift  (swagger gen + ng-openapi-gen check)  — aspnet:8.0 + node:20-slim
#
# Architecture note — stages 1–4 in ONE container:
#   Stages 1–4 run inside a single `docker run` invocation using an inner shell
#   script mounted via the repo bind-mount. This ensures build artifacts (bin/,
#   obj/) produced in stage 2 are immediately visible to stages 3–4 without any
#   cross-container filesystem flush dependency (eliminates VirtioFS latency on
#   macOS Docker Desktop).
#
# Security note — Docker socket bind-mount (stage 4):
#   Mounting /var/run/docker.sock grants the SDK container unrestricted access to
#   the host Docker daemon (equivalent to host root). This is required for
#   Testcontainers to spawn sibling MySQL containers. Only use this script in
#   trusted, developer-controlled environments — never in untrusted CI pipelines.
#
# Exit codes:
#   0        — All stages passed; stamps $(git rev-parse --absolute-git-dir)/ci-local-passed.stamp
#   non-zero — A stage failed.

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

GIT_DIR="$(git rev-parse --absolute-git-dir 2>/dev/null || echo "$REPO_ROOT/.git")"
STAMP_FILE="$GIT_DIR/ci-local-passed.stamp"
FAST_STAMP_FILE="$GIT_DIR/ci-local-fast-passed.stamp"

_log()  { printf '\033[1;34m[ci-local]\033[0m %s\n' "$*"; }
_ok()   { printf '\033[1;32m[ci-local][PASS]\033[0m %s\n' "$*"; }
_warn() { printf '\033[1;33m[ci-local][WARN]\033[0m %s\n' "$*" >&2; }
_die()  { printf '\033[1;31m[ci-local][FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

# SHA-256 of stdin — used for stamp fingerprinting only (not build/test)
compute_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())"
  else
    git hash-object --stdin
  fi
}

FAST_ONLY=false
SKIP_INTEGRATION=false
SKIP_DOCKER=false
SKIP_OPENAPI=false

for arg in "$@"; do
  case "$arg" in
    --fast)
      FAST_ONLY=true; SKIP_INTEGRATION=true; SKIP_DOCKER=true; SKIP_OPENAPI=true ;;
    --skip-integration) SKIP_INTEGRATION=true ;;
    --skip-docker)      SKIP_DOCKER=true ;;
    --skip-openapi)     SKIP_OPENAPI=true ;;
    --help|-h)
      cat <<'EOF'
Usage: scripts/verify-ci-local.sh [OPTIONS]

Run the full CI verification gate locally. ALL dotnet/npx commands execute
inside Docker containers — only docker CLI, git, curl, id, and uname are
required on the host.

Options:
  --fast              Stages 1-3 only (format, build, unit + arch tests).
                      Zero additional docker image downloads after first run.
  --skip-integration  Skip Testcontainers integration tests (stage 4).
  --skip-docker       Skip web production Docker build (stage 5).
  --skip-openapi      Skip OpenAPI drift check (stage 6).
  -h, --help          Show this help.

Docker images pulled on first run (cached thereafter):
  mcr.microsoft.com/dotnet/sdk:8.0    — build, format, test (stages 1-4)
  mcr.microsoft.com/dotnet/aspnet:8.0 — swagger generation (stage 6)
  node:20-slim                         — ng-openapi-gen drift check (stage 6)

Named volumes created on first run (persist NuGet/npm caches):
  ce-nuget-packages   — NuGet package cache (stages 1-4)
  ce-npm-cache        — npm package cache (stage 6)
EOF
      exit 0 ;;
    *) _die "Unknown argument: $arg" ;;
  esac
done

_log "Starting local CI verification gate (all dotnet/npx commands run inside Docker containers)..."

if ! command -v docker >/dev/null 2>&1; then
  _die "'docker' CLI not found in PATH. This script requires Docker Engine or Docker Desktop on the host."
fi

# ---------------------------------------------------------------------------
# Docker image constants
# ---------------------------------------------------------------------------
DOTNET_SDK_IMAGE="mcr.microsoft.com/dotnet/sdk:8.0"
DOTNET_RT_IMAGE="mcr.microsoft.com/dotnet/aspnet:8.0"
NODE_IMAGE="node:20-slim"

# Named volumes — persist between runs so packages are not re-downloaded
NUGET_CACHE_VOL="ce-nuget-packages"
NPM_CACHE_VOL="ce-npm-cache"

# ---------------------------------------------------------------------------
# Temp files — cleaned up on exit
# ---------------------------------------------------------------------------
CI_INNER="${REPO_ROOT}/.tmp-ci-dotnet-stages.sh"
SWAGGER_TEMP="${REPO_ROOT}/.tmp-ci-swagger.json"
API_CONTAINER="ce-ci-swagger-$$"

cleanup_all() {
  docker rm -f "$API_CONTAINER" >/dev/null 2>&1 || true
  rm -f "$CI_INNER" "$SWAGGER_TEMP"
}
trap cleanup_all EXIT

# ---------------------------------------------------------------------------
# Write the inner dotnet stages script (stages 1–4).
# This script is executed INSIDE the SDK container via the bind-mount.
# Running stages 1–4 in a single container means build artifacts from stage 2
# are immediately visible to stages 3–4 without cross-container flush latency.
# ---------------------------------------------------------------------------
cat > "$CI_INNER" << 'INNER_EOF'
#!/bin/sh
# Inner script: stages 1-4 inside the dotnet SDK container.
# Variables injected by docker run -e:
#   FAST_ONLY          (true/false)
#   INCLUDE_INTEGRATION (true/false)
# NOTE: base image uses dash for /bin/sh, which does NOT support `set -o pipefail`.
# Use `-eu` only; pipeline exit status is the last command's status.
set -eu

_log()  { printf '\033[1;34m[ci-local]\033[0m %s\n' "$*"; }
_ok()   { printf '\033[1;32m[ci-local][PASS]\033[0m %s\n' "$*"; }
_fail() { printf '\033[1;31m[ci-local][FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

# Stage 1: Format check
# git is available in the SDK image; repo is mounted at /workspace.
has_cs_changes() {
  git status --porcelain 2>/dev/null | grep -qE '\.cs$'
}
if [ "${FAST_ONLY:-false}" = "true" ] && ! has_cs_changes; then
  _ok "Stage 1/6: Skipped C# format check (no .cs files modified)."
else
  _log "Stage 1/6: Checking C# code format..."
  dotnet restore src/ControlEasyReborn.sln --verbosity quiet --nologo
  dotnet format src/ControlEasyReborn.sln --verify-no-changes --no-restore \
    || _fail "Format check failed! Run 'dotnet format src/ControlEasyReborn.sln' to fix formatting."
  _ok "Code format verified."
fi

# Stage 2: Build
_log "Stage 2/6: Building solution in Release mode..."
dotnet build src/ControlEasyReborn.sln --configuration Release --nologo \
  || _fail "Build failed."
_ok "Solution built successfully."

# Stage 3: Unit + Architecture tests
_log "Stage 3/6: Running Unit & Architecture tests..."
dotnet test tests/ControlEasyReborn.UnitTests \
    --configuration Release --no-build --nologo --logger "console;verbosity=minimal" \
  || _fail "Unit tests failed."
dotnet test tests/ControlEasyReborn.ArchitectureTests \
    --configuration Release --no-build --nologo --logger "console;verbosity=minimal" \
  || _fail "Architecture tests failed."
_ok "Unit and Architecture tests passed."

# Stage 4: Integration tests (Testcontainers MySQL)
if [ "${INCLUDE_INTEGRATION:-false}" = "true" ]; then
  _log "Stage 4/6: Running Integration tests (Testcontainers MySQL)..."
  dotnet test tests/ControlEasyReborn.IntegrationTests \
      --configuration Release --no-build --nologo --logger "console;verbosity=minimal" \
    || _fail "Integration tests failed."
  _ok "Integration tests passed."
fi
INNER_EOF
chmod +x "$CI_INNER"

# ---------------------------------------------------------------------------
# Stages 1–3 (fast) OR 1–4 (full): one SDK container
# ---------------------------------------------------------------------------
if [ "$SKIP_INTEGRATION" = true ]; then
  # Fast path — no Docker socket needed, no host networking
  _log "Running stages 1–3 inside SDK container..."
  docker run --rm \
    -v "${REPO_ROOT}:/workspace" \
    -v "${NUGET_CACHE_VOL}:/root/.nuget/packages" \
    -e FAST_ONLY="${FAST_ONLY}" \
    -e INCLUDE_INTEGRATION=false \
    -w /workspace \
    "$DOTNET_SDK_IMAGE" \
    sh /workspace/.tmp-ci-dotnet-stages.sh \
    || _die "Stages 1–3 failed inside SDK container."
else
  # Full path — bind Docker socket for Testcontainers; use host network on Linux
  # so Testcontainers sibling containers are reachable at 127.0.0.1.
  # On macOS/Windows Docker Desktop --network host is a no-op; we set
  # TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal so Testcontainers resolves
  # the correct IP for mapped ports via the Docker Desktop VM bridge.
  _log "Running stages 1–4 inside SDK container (Docker socket bound for Testcontainers)..."
  DOCKER_SOCK="/var/run/docker.sock"
  NETWORK_FLAGS=()
  TC_ENV=()
  if [ "$(uname -s)" = "Linux" ]; then
    NETWORK_FLAGS=(--network host)
  else
    TC_ENV=(-e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal)
    _warn "Non-Linux host: --network host not used; setting TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal for Docker Desktop."
  fi
  # Honor an already-running MySQL via CE_ITEST_MYSQL so the fixture's
  # Testcontainers-spawn path can be bypassed (parity with verify-ci-local.ps1).
  CE_ITEST_ENV=()
  if [ -n "${CE_ITEST_MYSQL:-}" ]; then
    CE_ITEST_ENV=(-e "CE_ITEST_MYSQL=${CE_ITEST_MYSQL}")
  fi
  docker run --rm \
    "${NETWORK_FLAGS[@]+"${NETWORK_FLAGS[@]}"}" \
    -v "${REPO_ROOT}:/workspace" \
    -v "${NUGET_CACHE_VOL}:/root/.nuget/packages" \
    -v "${DOCKER_SOCK}:${DOCKER_SOCK}" \
    -e DOCKER_HOST="unix://${DOCKER_SOCK}" \
    "${TC_ENV[@]+"${TC_ENV[@]}"}" \
    "${CE_ITEST_ENV[@]+"${CE_ITEST_ENV[@]}"}" \
    -e FAST_ONLY="${FAST_ONLY}" \
    -e INCLUDE_INTEGRATION=true \
    -w /workspace \
    "$DOTNET_SDK_IMAGE" \
    sh /workspace/.tmp-ci-dotnet-stages.sh \
    || _die "Stages 1–4 failed inside SDK container."
fi

# ---------------------------------------------------------------------------
# Stage 5: Web Production Build (host Docker daemon — already container-native)
# ---------------------------------------------------------------------------
if [ "$SKIP_DOCKER" = true ]; then
  _warn "Stage 5/6: Skipping web build check (--skip-docker specified)."
else
  _log "Stage 5/6: Verifying Web production build (docker build)..."
  docker build -f docker/web.Dockerfile -t ce-local-verify-web:latest . \
    || _die "Web production Docker build failed."
  docker rmi ce-local-verify-web:latest >/dev/null 2>&1 || true
  _ok "Web production build verified."
fi

# ---------------------------------------------------------------------------
# Stage 6: OpenAPI Drift Check
#   a) Start API in aspnet:8.0 container using the DLL built in stages 1-4.
#   b) Fetch swagger.json via curl (HTTP probe — not a build tool).
#   c) Run ng-openapi-gen inside a node:20-slim container (version pinned from
#      package.json to ensure deterministic output; --user preserves host ownership).
#   d) Check git diff on host (git is always available on the host).
# ---------------------------------------------------------------------------
if [ "$SKIP_OPENAPI" = true ]; then
  _warn "Stage 6/6: Skipping OpenAPI drift check (--skip-openapi specified)."
else
  _log "Stage 6/6: Verifying OpenAPI client and swagger drift..."

  find_free_port() {
    if command -v python3 >/dev/null 2>&1; then
      python3 -c \
        'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()' \
        2>/dev/null && return 0
    fi
    # Fallback: hash-based port; guard against empty string from tr -dc '0-9'
    local h
    h="$(basename "$REPO_ROOT" | compute_sha256 | tr -dc '0-9' | cut -c1-4)"
    h="${h:-0}"
    echo "$(( 18100 + (h % 800) ))"
  }

  API_PORT="${CE_SWAGGER_PORT:-$(find_free_port)}"
  API_DLL_REL="src/Host/ControlEasyReborn.Api/bin/Release/net8.0/ControlEasyReborn.Api.dll"

  if [ ! -f "${REPO_ROOT}/${API_DLL_REL}" ]; then
    _die "API binary not found at ${API_DLL_REL}. Make sure stages 1-4 succeeded."
  fi

  # Pin ng-openapi-gen to the version declared in package.json.
  # Running inside a node container so no host-side node/npm needed.
  _log "Resolving ng-openapi-gen version from package.json..."
  NG_GEN_VERSION=$(docker run --rm \
    -v "${REPO_ROOT}/src/Web/ControlEasyReborn.Web/package.json:/tmp/pkg.json:ro" \
    "$NODE_IMAGE" \
    node -e "
      const p = require('/tmp/pkg.json');
      const v = (p.devDependencies||{})['ng-openapi-gen']
             || (p.dependencies||{})['ng-openapi-gen']
             || 'latest';
      console.log(v.replace(/^[\\^~]/, ''));
    " 2>/dev/null || echo "latest")
  _log "Using ng-openapi-gen@${NG_GEN_VERSION}"

  # Preserve host file ownership for generated files so git diff sees them correctly
  # and subsequent host-side npm/dotnet builds are not blocked by root-owned files.
  HOST_UID="$(id -u 2>/dev/null || echo 0)"
  HOST_GID="$(id -g 2>/dev/null || echo 0)"
  # If already root (uid=0), --user flag is not needed
  NODE_USER_FLAGS=()
  if [ "$HOST_UID" != "0" ]; then
    NODE_USER_FLAGS=(--user "${HOST_UID}:${HOST_GID}")
  fi

  _log "Starting API container for swagger generation (host port ${API_PORT})..."
  docker run -d \
    --name "$API_CONTAINER" \
    -p "${API_PORT}:8080" \
    -v "${REPO_ROOT}:/workspace:ro" \
    -e ASPNETCORE_ENVIRONMENT=Development \
    -e Bootstrap__Enabled=false \
    -e Db__Provider=MySQL \
    -e Db__Host=127.0.0.1 \
    -e Db__Port=3306 \
    -e Db__Database=controleasydb \
    -e Db__Username=dummy \
    -e Db__Password=dummy \
    -e Storage__Provider=Local \
    -e Storage__Local__Path=/tmp/photos \
    -e "Jwt__SigningKey=CI-DUMMY-KEY-FOR-SWAGGER-GEN-ONLY-32-CHARS!!" \
    -e Jwt__Issuer=ControlEasyReborn \
    -e Jwt__Audience=ControlEasyReborn \
    "$DOTNET_RT_IMAGE" \
    dotnet "/workspace/${API_DLL_REL}" --urls "http://0.0.0.0:8080" \
    >/dev/null

  # Poll swagger endpoint until ready (curl is an HTTP client — not a build tool)
  deadline=$((SECONDS + 45))
  READY=false
  while (( SECONDS < deadline )); do
    STATUS=$(curl --connect-timeout 2 --max-time 5 --silent \
      -o /dev/null -w "%{http_code}" \
      "http://127.0.0.1:${API_PORT}/swagger/v1/swagger.json" 2>/dev/null || echo "000")
    [ "$STATUS" = "200" ] && { READY=true; break; }
    sleep 1
  done

  if [ "$READY" = false ]; then
    _die "API container failed to start within 45s. Check: docker logs ${API_CONTAINER}"
  fi

  curl --fail --silent --show-error \
    "http://127.0.0.1:${API_PORT}/swagger/v1/swagger.json" -o "$SWAGGER_TEMP"
  docker rm -f "$API_CONTAINER" >/dev/null 2>&1 || true

  # Run ng-openapi-gen in node container.
  # --user ensures generated files are owned by the host user, not root.
  # -e NPM_CONFIG_CACHE points npm cache to the named volume writable by HOST_UID.
  # swagger.json is inside $REPO_ROOT (= /workspace) so the container can read it.
  _log "Running ng-openapi-gen@${NG_GEN_VERSION} drift check (inside node container)..."
  docker run --rm \
    "${NODE_USER_FLAGS[@]+"${NODE_USER_FLAGS[@]}"}" \
    -v "${REPO_ROOT}:/workspace" \
    -v "${NPM_CACHE_VOL}:/tmp/.npm" \
    -e NPM_CONFIG_CACHE=/tmp/.npm \
    -w /workspace/src/Web/ControlEasyReborn.Web \
    "$NODE_IMAGE" \
    sh -c "npx -y ng-openapi-gen@${NG_GEN_VERSION} --input /workspace/.tmp-ci-swagger.json --config ng-openapi-gen.json" \
    || _die "ng-openapi-gen execution failed! Verify swagger schema and ng-openapi-gen.json config."

  # git diff on host — git is always available on the host
  if ! git diff --exit-code -- src/Web/ControlEasyReborn.Web/src/app/api; then
    _die "OpenAPI client drift detected! Generated types in src/app/api differ from swagger. Commit the regenerated files."
  fi

  _ok "OpenAPI drift check passed."
fi

# ---------------------------------------------------------------------------
# Stamp success state — uses only git + compute_sha256 (host utilities)
# ---------------------------------------------------------------------------
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo "none")"
DIFF_HASH="$(git diff HEAD 2>/dev/null | compute_sha256)"
STATUS_HASH="$(git status --porcelain=v1 -uall 2>/dev/null | compute_sha256)"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STAMP_CONTENT="${HEAD_SHA}:${DIFF_HASH}:${STATUS_HASH}:${TIMESTAMP}"

if [ "$FAST_ONLY" = true ] || [ "$SKIP_INTEGRATION" = true ] || \
   [ "$SKIP_DOCKER" = true ]  || [ "$SKIP_OPENAPI" = true ]; then
  mkdir -p "$(dirname "$FAST_STAMP_FILE")"
  printf '%s\n' "$STAMP_CONTENT" > "$FAST_STAMP_FILE"
  _ok "Fast local CI verification checks PASSED!"
else
  mkdir -p "$(dirname "$STAMP_FILE")"
  printf '%s\n' "$STAMP_CONTENT" > "$STAMP_FILE"
  printf '%s\n' "$STAMP_CONTENT" > "$FAST_STAMP_FILE"
  _ok "All local CI verification gates PASSED (Testcontainers + Docker web build + OpenAPI drift)!"
fi
