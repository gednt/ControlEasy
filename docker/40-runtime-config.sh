#!/bin/sh
set -eu

: "${TIME_ZONE:=America/Sao_Paulo}"

case "$TIME_ZONE" in
  *[!A-Za-z0-9_+./-]*|'') TIME_ZONE='America/Sao_Paulo' ;;
esac

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__CE_RUNTIME_CONFIG__ = { timeZone: '${TIME_ZONE}' };
EOF
