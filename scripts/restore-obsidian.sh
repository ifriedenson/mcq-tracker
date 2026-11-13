#!/bin/bash
# One-command (re)install + launch of real Obsidian with MCQ Tracker + Primary theme.
# Idempotent: every step is skipped when already present, so a fresh session after
# an archive restore and a healthy session both end running. See AGENTS.md
# "Real Obsidian on this VM". Runs with no sudo.
set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
MAMBA_BIN="$HOME/.local/bin/micromamba"
export MAMBA_ROOT_PREFIX="$HOME/.micromamba"
ENV_PREFIX="$HOME/.micromamba/envs/obsidian"
OBSIDIAN_VER="1.15.1"
APPIMAGE="$HOME/downloads/Obsidian-${OBSIDIAN_VER}.AppImage"
SQUASH="$HOME/downloads/squashfs-root"
XVFB_ROOT="$HOME/.local/xvfb-root"
DEB_DIR="$HOME/debs"
VAULT="$HOME/.local/mcq-vault"
PROFILE="$HOME/.local/obsidian-profile"
ARCHIVE="http://archive.ubuntu.com/ubuntu"

echo "== micromamba =="
if [ ! -x "$MAMBA_BIN" ]; then
  mkdir -p "$HOME/.local/bin"
  curl -Ls "https://micro.mamba.pm/api/micromamba/linux-64/latest" -o /tmp/micromamba.tar.bz2
  tar -xjf /tmp/micromamba.tar.bz2 -C /tmp/
  cp /tmp/bin/micromamba "$MAMBA_BIN"
fi
"$MAMBA_BIN" --version

echo "== conda env (gtk3, nss, fonts, ...) =="
if [ ! -x "$ENV_PREFIX/bin/fc-cache" ]; then
  "$MAMBA_BIN" create -y -p "$ENV_PREFIX" -c conda-forge \
    gtk3 nss nspr alsa-lib atk at-spi2-atk at-spi2-core libcups libdrm \
    libxkbcommon xorg-libxcomposite xorg-libxdamage xorg-libxrandr pango cairo \
    xorg-libxfixes xorg-libxext xorg-libx11 xorg-libxcb dbus libexpat libgbm \
    fontconfig fonts-conda-ecosystem
fi

echo "== Obsidian ${OBSIDIAN_VER} =="
mkdir -p "$HOME/downloads"
if [ ! -f "$APPIMAGE" ]; then
  curl -L -o "$APPIMAGE" "https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VER}/Obsidian-${OBSIDIAN_VER}.AppImage"
fi
if [ ! -x "$SQUASH/obsidian" ]; then
  chmod +x "$APPIMAGE"
  (cd "$HOME/downloads" && ./Obsidian-${OBSIDIAN_VER}.AppImage --appimage-extract)
fi

echo "== Xvfb user-space root =="
mkdir -p "$DEB_DIR" "$XVFB_ROOT"
if [ ! -x "$XVFB_ROOT/usr/bin/Xvfb" ]; then
  cd "$DEB_DIR"
  for f in \
    "pool/universe/x/xorg-server/xvfb_21.1.12-1ubuntu1_amd64.deb" \
    "pool/main/x/xorg-server/xserver-xorg-core_21.1.12-1ubuntu1_amd64.deb" \
    "pool/main/x/xorg-server/xserver-common_21.1.12-1ubuntu1_all.deb" \
    "pool/main/libx/libxfont/libxfont2_2.0.6-1build1_amd64.deb" \
    "pool/main/libx/libxcvt/libxcvt0_0.1.2-1build1_amd64.deb" \
    "pool/main/libf/libfontenc/libfontenc1_1.1.8-1build1_amd64.deb" \
    "pool/main/x/x11-xkb-utils/x11-xkb-utils_7.7+8build2_amd64.deb" \
    "pool/main/x/xkeyboard-config/xkb-data_2.41-2ubuntu1_all.deb" \
    "pool/main/libx/libxkbfile/libxkbfile1_1.1.0-1build4_amd64.deb"; do
    [ -f "$(basename "$f")" ] || curl -s -O "$ARCHIVE/$f"
    dpkg-deb -x "$(basename "$f")" "$XVFB_ROOT/"
  done
fi

echo "== vault (fresh plugin build + Primary theme) =="
cd "$REPO" && node scripts/build.js
rm -rf "$VAULT" && mkdir -p "$VAULT"
cp -r "$REPO/samples/sample-vault/." "$VAULT/"
mkdir -p "$VAULT/.obsidian/plugins/mcq-tracker" "$VAULT/.obsidian/themes/Primary"
cp "$REPO/main.js" "$REPO/manifest.json" "$REPO/styles.css" "$VAULT/.obsidian/plugins/mcq-tracker/"
curl -s -o "$VAULT/.obsidian/themes/Primary/manifest.json" "https://raw.githubusercontent.com/primary-theme/obsidian/main/manifest.json"
curl -s -o "$VAULT/.obsidian/themes/Primary/theme.css" "https://raw.githubusercontent.com/primary-theme/obsidian/main/theme.css"
printf '{"cssTheme": "Primary"}\n' > "$VAULT/.obsidian/appearance.json"
printf '["mcq-tracker"]\n' > "$VAULT/.obsidian/community-plugins.json"
printf '{}\n' > "$VAULT/.obsidian/app.json"
mkdir -p "$PROFILE"
if [ ! -f "$PROFILE/obsidian.json" ]; then
  printf '{"vaults": {"mcqtracker01vault": {"path": "%s", "ts": 1763040000000, "open": true}}}\n' "$VAULT" > "$PROFILE/obsidian.json"
fi

echo "== launch =="
bash "$HOME/.local/bin/run-xvfb.sh"
bash "$HOME/.local/bin/run-obsidian.sh"
sleep 20
curl -s --max-time 5 http://127.0.0.1:9222/json | python3 -c "import json,sys; [print('TARGET:',t['title']) for t in json.load(sys.stdin)]"
