#!/bin/sh
# Runs as root before s6-overlay's /init. Everything OpenBot keeps lives in mounted volumes:
#   /config              keys from the setup page, the credential encryption key, last refusal
#   /var/lib/postgresql  the embedded database
#   /workspace /profiles the Bots' files and browser profile
set -eu

# Omarchy Server passes the app password; OpenBot admits only browsers that have entered it.
if [ -z "${OPENBOT_INSTALL_TOKEN:-}" ]; then
  echo "Set OPENBOT_INSTALL_TOKEN (the app password)." >&2
  exit 1
fi

mkdir -p /config /workspace /profiles /var/lib/postgresql
chmod 700 /config
for d in /workspace /profiles; do
  [ "$(stat -c %u "$d")" = "$(id -u pwuser)" ] || chown -R pwuser:pwuser "$d"
done

# OpenBot encrypts stored model credentials with this; it must stay the same for the life of the data.
if [ ! -s /config/key-encryption-key ]; then
  (umask 077; head -c 32 /dev/urandom | base64 > /config/key-encryption-key)
fi

# No keys yet, or OpenBot refused the last ones: serve the setup page until they're saved.
while [ ! -s /config/openbot.env ] || [ -e /config/last-refusal ]; do
  bun /opt/omarchy-setup/setup.ts || sleep 2
done

# Only these names are read from the file, each exported as-is (never evaluated by the shell).
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    CPK_INTELLIGENCE_API_KEY=*|BOT_PROVIDER=*|ANTHROPIC_API_KEY=*|OPENAI_API_KEY=*|OPENAI_BASE_URL=*) export "$line" ;;
  esac
done < /config/openbot.env

KEY_ENCRYPTION_KEY="$(cat /config/key-encryption-key)"
export KEY_ENCRYPTION_KEY

exec /init
