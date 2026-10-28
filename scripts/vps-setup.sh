#!/usr/bin/env bash
# One-time setup of the production VPS (srv1760732, 187.127.128.78) for
# https://shop.itarang.com. Run as root on the VPS:
#
#   ssh -i ~/.ssh/shop_vps_deploy root@187.127.128.78 'bash -s' < scripts/vps-setup.sh
#
# Idempotent: safe to run again.
#
# **What it does.** Installs Node 22 and rsync, creates an unprivileged `shop`
# user, the release directory and a systemd service that runs the standalone
# Next server on 127.0.0.1:3100, and adds one route file to Traefik's watched
# directory so Traefik serves shop.itarang.com with a Let's Encrypt certificate.
#
# **What it does not touch.** The VPS already runs Hostinger's Traefik (in
# Docker, host network, owning ports 80/443) and the Hermes agent containers.
# Neither is restarted or reconfigured: Traefik picks the new file up on its own
# because it watches /docker/traefik/dynamic.
#
# Releases are uploaded by the `deploy` job in .github/workflows/ci.yml into
# /srv/itarang-shop/releases/<release>; `current` is a symlink to the live one.
set -euo pipefail

APP_ROOT=/srv/itarang-shop
PORT=3100
TRAEFIK_DYNAMIC=/docker/traefik/dynamic

export DEBIAN_FRONTEND=noninteractive

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
command -v rsync >/dev/null || apt-get install -y rsync >/dev/null
echo "node $(node -v), $(rsync --version | head -1)"

id shop >/dev/null 2>&1 || useradd --system --home "$APP_ROOT" --shell /usr/sbin/nologin shop
mkdir -p "$APP_ROOT/releases"

cat > /etc/systemd/system/itarang-shop.service <<UNIT
[Unit]
Description=iTarang storefront (shop.itarang.com)
After=network-online.target
Wants=network-online.target

[Service]
User=shop
Group=shop
WorkingDirectory=$APP_ROOT/current
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
# Daily jobs (R-08: invoice reminder). The token is read from the live
# release's env file at run time, so rotating CRON_SECRET needs only a deploy.
# No CRON_SECRET there means the route is off and the job does nothing.
cat > /usr/local/bin/itarang-shop-cron <<'SCRIPT'
#!/bin/sh
set -eu
secret=$(grep -m1 '^CRON_SECRET=' /srv/itarang-shop/current/.env.production | cut -d= -f2- || true)
[ -n "$secret" ] || { echo "CRON_SECRET not set; skipping"; exit 0; }
curl -fsS -X POST -H "Authorization: Bearer $secret" \
  http://127.0.0.1:3100/api/cron/invoice-reminder
SCRIPT
chmod 755 /usr/local/bin/itarang-shop-cron

cat > /etc/systemd/system/itarang-shop-cron.service <<UNIT
[Unit]
Description=iTarang storefront daily jobs (invoice reminder)
After=itarang-shop.service

[Service]
Type=oneshot
User=shop
Group=shop
ExecStart=/usr/local/bin/itarang-shop-cron
UNIT

# 09:30 IST every day; Persistent catches up a run missed while the host was down.
cat > /etc/systemd/system/itarang-shop-cron.timer <<UNIT
[Unit]
Description=Run the iTarang storefront daily jobs

[Timer]
OnCalendar=*-*-* 04:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable itarang-shop >/dev/null 2>&1
systemctl enable --now itarang-shop-cron.timer >/dev/null 2>&1
echo "systemd: itarang-shop enabled (it starts on the first deploy); daily cron timer on"

if [ -d "$TRAEFIK_DYNAMIC" ]; then
  cat > "$TRAEFIK_DYNAMIC/itarang-shop.yml" <<YML
# iTarang storefront: the Node service on this host (systemd itarang-shop).
http:
  routers:
    itarang-shop:
      rule: Host(\`shop.itarang.com\`)
      entryPoints: [websecure]
      service: itarang-shop
      tls:
        certResolver: letsencrypt
  services:
    itarang-shop:
      loadBalancer:
        servers:
          - url: http://127.0.0.1:$PORT
YML
  echo "traefik: route for shop.itarang.com written to $TRAEFIK_DYNAMIC/itarang-shop.yml"
else
  echo "WARNING: $TRAEFIK_DYNAMIC not found — Traefik route not written" >&2
fi

echo "done"
