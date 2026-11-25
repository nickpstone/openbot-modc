# OpenBot for Omarchy Server

[OpenBot](https://github.com/CopilotKit/OpenBot) (MIT, by CopilotKit) packaged as one app for
[Omarchy Server](https://github.com/MyOwnDataCenter/Modc-app-store) / TouchWorkStation. OpenBot is
CopilotKit's workspace for AI coworkers, and also carries the retired OpenDots as a skin
(Settings › Skin › OpenDots).

This image is the official `ghcr.io/copilotkit/openbot` image with three additions:

- **A first-run setup page.** OpenBot refuses to start without a CopilotKit Intelligence project key,
  and the App Store has no place to type keys in. Until keys are saved in `/config/openbot.env`, the
  container serves a small page on port 3001 asking for the Intelligence key and an Anthropic or
  OpenAI key. If OpenBot later refuses the saved keys, the reason is kept in `/config/last-refusal`
  and the next start shows the setup page again with that reason, instead of crash-looping.
- **Password sign-in.** A single-user OpenBot only admits browsers carrying its install token
  (`OPENBOT_INSTALL_TOKEN`, set to the app password). `/signin.html` asks for it and passes it to
  OpenBot's own `/api/install/enter`, which sets a 400-day cookie. A short check added to the top
  of `index.html` sends a browser without that cookie to the sign-in page.
- **Defaults:** the embedded PostgreSQL, single-user mode and managed CopilotKit Intelligence. The
  key that encrypts stored credentials is generated once into `/config/key-encryption-key`.

## Addresses

OpenBot only answers addresses it knows. IP addresses always work. The entrypoint also allows each
name in `OPENBOT_HOSTS` (comma separated) on port `OPENBOT_WEB_PORT`, over http and https, plus any
origins listed one per line in `/config/extra-origins`. In single-user mode OpenBot refuses to start
with an address the public internet reaches, and it counts Tailscale `*.ts.net` names as public, so
use the Tailscale IP instead.

## Volumes

| Path | What |
| --- | --- |
| `/config` | keys from the setup page, the encryption key |
| `/var/lib/postgresql` | the database |
| `/workspace`, `/profiles` | the Bots' files and browser profile |

## Build

```sh
podman build --format docker --build-arg OPENBOT_VERSION=v1.1.3 -t ghcr.io/nickpstone/openbot:1.1.3-2 .
```
