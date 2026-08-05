---
title: "AI Workspace configuration and environment interpolation"
description: "How AI Workspace and the Platform API load their config.toml files, inject environment values and mounted files through interpolation tokens, and keep sensitive values out of the config file."
canonical_url: https://wso2.com/api-platform/docs/next/ai-workspace/setting-up/configuration/
md_url: https://wso2.com/api-platform/docs/next/ai-workspace/setting-up/configuration.md
tags:
  - ai-workspace
  - configuration
  - interpolation
author: WSO2 API Platform Documentation Team
last_updated: 2026-07-24
content_type: "reference"
---

# AI Workspace configuration and environment interpolation

The AI Workspace stack has two services: the AI Workspace Backend-for-Frontend (BFF) and the Platform API it proxies to. Each reads its configuration from a TOML file (`config.toml`) layered over built-in defaults.

This page explains how each service loads its config file. It also covers how environment values and mounted files are injected through interpolation tokens, and how to keep sensitive values out of the file. For provisioning the keys, certificates, and credentials those tokens resolve to, see [Get started with AI Workspace](../getting-started.md).

## How configuration is loaded

Each service reads a TOML file mounted into its container, layered over that service's built-in defaults:

- **AI Workspace (BFF)** — `/etc/ai-workspace/config.toml`; every key lives under the `[ai_workspace]` table.
- **Platform API** — `/etc/platform-api/config.toml`; every key lives under the `[platform_api]` table.

The per-service namespacing (`[ai_workspace]`, `[platform_api]`, `[api_portal]`) lets one `config.toml` hold multiple services' sections side by side without their keys colliding — each service reads only its own table.

!!! important "Environment variables don't override config keys directly"
    There is **no prefix that auto-maps environment variables onto config keys.** An environment value reaches a setting **only** through an explicit interpolation token written into the config file, resolved when the file is loaded. A key written as a plain literal — or absent from the file — ignores the matching variable entirely.

## Interpolation tokens

Two functions are available inside `config.toml`:



| Token | Behavior |
|-------|----------|
| `{{ env "NAME" "default" }}` | Substitutes the value of environment variable `NAME`. If the variable is unset **or set-but-empty**, the `default` is used. If no default is given, an unset variable fails startup. |
| `{{ file "PATH" }}` | Reads a secret value from a mounted file at `PATH` — for injecting secrets from a mounted volume rather than an environment variable. A trailing newline is trimmed. |

An example from the shipped AI Workspace `config.toml`:

```toml
[ai_workspace.control_plane]
url = '{{ env "APIP_AIW_CONTROL_PLANE_URL" "https://platform-api:9243" }}'

[ai_workspace.auth]
mode = '{{ env "APIP_AIW_AUTH_MODE" "basic" }}'
```



Most tokens in the shipped config carry a default, so an unset variable keeps the built-in value. A token written without a default names a required secret, and startup fails when that variable isn't set.

!!! note "The variable name is a naming convention, not a prefix override"
    By convention each token names the key's dotted path, uppercased with dots as underscores, behind a per-service prefix. The prefixes are `APIP_AIW_` for AI Workspace, `APIP_CP_` for the Platform API, and `APIP_AP_` for the API Portal. For example, `[ai_workspace.control_plane] url` becomes `APIP_AIW_CONTROL_PLANE_URL`. The loader doesn't interpret the prefix — the name is only the literal string you pass to the interpolation function. You can rename any variable, as long as you edit the matching token in `config.toml` to agree.

### Which variables your deployment reads

Because the variable names live in `config.toml`, the config file is the authoritative list for your deployment — not this page. To see which settings your stack injects from the environment, search the mounted `config.toml` for `{{ env` and read the name out of each token.

For every configurable option and the tokens the shipped files carry, refer to the config templates: [AI Workspace](https://github.com/wso2/api-platform/blob/main/portals/ai-workspace/configs/config-template.toml) and [Platform API](https://github.com/wso2/api-platform/blob/main/platform-api/config/config-template.toml).

## Sensitive values in `config.toml`

This section covers credentials the services need to start — database passwords, the OpenID Connect (OIDC) client secret, and the at-rest encryption key. It's a separate mechanism from the [AI Workspace secrets](../secrets-management.md) feature, which stores encrypted credentials you reference from artifacts.

Never write a sensitive value as a literal in `config.toml`, and never hardcode one in `docker-compose.yaml`. Reference each with an interpolation token — from an environment variable or, preferably, from a mounted file:



```toml
# Platform API at-rest encryption key - the shipped default reads a mounted file:
encryption_key = '{{ file "/etc/platform-api/keys/encryption.key" }}'
# or, alternatively, from an environment variable:
# encryption_key = '{{ env "APIP_CP_ENCRYPTION_KEY" }}'

# AI Workspace OIDC client secret (oidc mode) - env var, or a mounted file:
client_secret = '{{ env "APIP_AIW_AUTH_OIDC_CLIENT_SECRET" }}'
# client_secret = '{{ file "/secrets/ai-workspace/oidc_client_secret" }}'
```



Neither `encryption_key` nor `client_secret` carries a default, so each is a required secret. Both forms fail closed: if the variable is unset or empty, or the file is missing or outside the allowed source directories, the service refuses to start. A `{{ file }}` path must live under an allowed directory — `/etc/ai-workspace` or `/secrets/ai-workspace` for the BFF, `/etc/platform-api` or `/secrets/platform-api` for the Platform API. Override the list with the shared `APIP_CONFIG_FILE_SOURCE_ALLOWLIST` (comma-separated; it **replaces** the defaults rather than extending them).

!!! important "Two unrelated mechanisms"
    The `{{ env }}` and `{{ file }}` tokens on this page are resolved by the service's config loader at startup, and only inside `config.toml`. The `{{ secret "handle" }}` placeholder of [Secrets management](../secrets-management.md) is resolved by the gateway at request time, and only inside artifact configurations. Neither works in the other's place.

## Where the values come from

Provisioning the keys, certificates, and credentials the tokens resolve to is part of setting the stack up, not part of how the config loader works. For those steps, see:

- [Run the setup script](../getting-started.md#step-2-run-the-setup-script) — what a fresh stack is given, and where each artifact lands.
- [Rerun the setup script](../getting-started.md#rerun-the-setup-script) — the flags, and which of them rotate what.
- [Provision the at-rest encryption key manually](../getting-started.md#provision-the-at-rest-encryption-key-manually) — the path for a deployment that doesn't use the script.
- [Change environment values after setup](../getting-started.md#change-environment-values-after-setup) — editing `api-platform.env`, the file Compose loads into the containers.

## Related

- [Get started with AI Workspace](../getting-started.md): provision the keys, certificates, and credentials the tokens resolve to
- [Change the ports AI Workspace uses](ports.md): move the stack off its default ports