# Runpod Executor Bootstrap

## Purpose
This document defines the smallest reproducible bootstrap for a Runpod-hosted Butterfly execution node when Tailscale is unavailable or blocked by the container runtime.

## Posture
- keep the sovereign controller on the workstation
- treat the Runpod Pod as a replaceable execution node
- bind the executor to loopback only by default
- prefer Tailscale/private-overlay when available
- fall back to a controlled public gateway path when the overlay is unavailable

## Pod layout
- `/workspace/butterfly-ide/` — repo checkout
- `/workspace/butterfly-runtime/runtime/` — executor process
- `/workspace/butterfly-runtime/logs/` — runtime logs
- `/workspace/butterfly-runtime/state/` — lightweight restartable state only

## Bootstrap artifact
Use `butterfly_ide_lib/tools/runpod_executor.py` as the narrow control surface.

It exposes:
- `GET /health`
- `GET /handshake`
- `GET /model/status`
- `POST /model/invoke`

The executor is stdlib-only and can proxy to an approved local model backend when `BUTTERFLY_MODEL_BACKEND_URL` is set.

## Suggested startup
From `/workspace/butterfly-ide` on the Pod:

1. create `/workspace/butterfly-runtime/{runtime,logs,state}`
2. copy or link `butterfly_ide_lib/tools/runpod_executor.py` into `/workspace/butterfly-runtime/runtime/`
3. optionally set:
   - `BUTTERFLY_MODEL_BACKEND_URL`
   - `BUTTERFLY_MODEL_BACKEND_HEALTH_URL`
4. start the executor bound to `127.0.0.1:9000`
5. verify `/health` and `/handshake`

## Controller access
Because the executor binds to loopback, controller access should use one of:
- approved Tailscale/private-overlay connectivity
- SSH tunneling during bring-up
- an explicitly approved reverse proxy or controlled public gateway later

The local controller should model this path as:
- a sovereign local controller profile on the workstation
- an AI interface endpoint bound to local loopback
- an SSH tunnel forwarding `127.0.0.1:<local-port>` to Pod `127.0.0.1:9000` when Runpod remains in controlled-public-gateway mode

## Network interpretation
For Runpod Community Pods that lack `/dev/net/tun`, represent the remote node as:
- `RemoteAccessPath::ControlledPublicGateway`
- no Tailscale metadata
- deployment/validation roles only

This keeps Butterfly aligned with its policy model without pretending the Pod has a private-overlay path that does not exist.