# OpenBot (https://github.com/CopilotKit/OpenBot) packaged for Omarchy Server / Modc App Store.
# The official one-container image, plus a first-run page for the keys OpenBot can't start without.
ARG OPENBOT_VERSION=v1.1.3
FROM ghcr.io/copilotkit/openbot:${OPENBOT_VERSION}

LABEL org.opencontainers.image.source=https://github.com/nickpstone/openbot-modc \
      org.opencontainers.image.description="OpenBot (CopilotKit/OpenBot) for Omarchy Server" \
      org.opencontainers.image.licenses=MIT

COPY setup.ts setup.html /opt/omarchy-setup/
COPY entrypoint.sh /usr/local/bin/omarchy-entrypoint
# A password page for the install token, and a check at the top of the app that sends a browser
# without OpenBot's install cookie there (otherwise the app loads and every call is refused).
COPY signin.html /app/app/dist/signin.html
COPY install-gate.html /tmp/install-gate.html
RUN node -e 'const f="/app/app/dist/index.html",fs=require("fs");let s=fs.readFileSync(f,"utf8");if(!s.includes("<head>"))process.exit(1);fs.writeFileSync(f,s.replace("<head>","<head>"+fs.readFileSync("/tmp/install-gate.html","utf8")))' \
 && rm -f /tmp/install-gate.html /app/app/dist/index.html.gz /app/app/dist/index.html.br \
 && grep -q 'signin.html' /app/app/dist/index.html
# Keep the reason OpenBot refused to start, so the next start shows it on the setup page.
RUN chmod 755 /usr/local/bin/omarchy-entrypoint \
 && sed -i 's|^exit 0$|if [ -f "$REASON" ] \&\& [ ! -L "$REASON" ] \&\& [ -d /config ]; then cat "$REASON" > /config/last-refusal; fi\nexit 0|' /etc/s6-overlay/scripts/refusal-reason.sh \
 && grep -q last-refusal /etc/s6-overlay/scripts/refusal-reason.sh

ENV EMBEDDED_POSTGRES=on \
    OPENBOT_SINGLE_USER=true \
    INTELLIGENCE_API_URL=https://api.intelligence.copilotkit.ai \
    INTELLIGENCE_GATEWAY_WS_URL=wss://realtime.intelligence.copilotkit.ai

EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/omarchy-entrypoint"]
