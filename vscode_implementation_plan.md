# Implementation Plan - VS Code (code-server) Setup on VPS

This plan outlines the deployment of `code-server` (VS Code in Browser) on your VPS, fully integrated with your existing Docker orchestrator network (`orchestrator_factory_net` / `factory_net`) and routed securely via Cloudflare Tunnels.

## Proposed Changes

We will create two main components:
1. A highly optimized, fallback-resilient GitHub Actions workflow to deploy/redeploy code-server.
2. A dedicated `apps/code-server` directory containing a standalone `docker-compose.yml` configuration and a comprehensive architectural integration and routing guide.

---

### Component 1: GitHub Actions Workflow

#### [NEW] [deploy-code-server.yml](file:///e:/github-vscode-backup/orchestratorHTTPS/.github/workflows/deploy-code-server.yml)
We will create a custom workflow featuring:
- **`workflow_dispatch` trigger** with a required `password` input (minimum 8 characters) for accessing your VS Code instance securely.
- **Robust secret fallbacks**: It will support the repository's standard secrets (`GLOBAL_VPS_IP`, `GLOBAL_SSH_KEY`, `GLOBAL_VPS_PORT` / `GLOBAL_VPS_SSH_PORT`) as well as the classic `VPS_HOST`, `VPS_SSH_KEY`, `VPS_PORT`, and `VPS_USER` variables.
- **Docker Network Joining**: Automatically creates and joins the container to `orchestrator_factory_net` so your central Cloudflare Tunnel container (`tunnel`) can route to it internally (e.g. at `http://code-server:8080`) without exposing any public ports on the VPS.
- **Host Port Binding**: Maps to `127.0.0.1:8080:8080` for maximum flexibility, allowing standard host-level Cloudflare Tunnel routing to `http://localhost:8080` if preferred.
- **Persistent Storage mounts**: Automatically creates and binds `~/projects` and `~/.config/code-server` on your VPS to ensure files and editor configurations are preserved across deployments.

---

### Component 2: Application Template and Guide

#### [NEW] [docker-compose.yml](file:///e:/github-vscode-backup/orchestratorHTTPS/apps/code-server/docker-compose.yml)
A standalone Compose configuration allowing you to manage or run `code-server` via traditional docker-compose commands if desired:
- Connects to the external `factory_net` network.
- Declares the standard volume bounds and environment variables.

#### [NEW] [README.md](file:///e:/github-vscode-backup/orchestratorHTTPS/apps/code-server/README.md)
A detailed guide for Cloudflare Zero Trust tunnel setup, routing alternatives, password management, and extensions.

---

## Verification Plan

We will verify this implementation through:
1. **GitHub Actions Syntax check**: Verify that the YAML is structurally valid.
2. **Path & Connectivity checks**: Verify that the directories sync correctly.
3. **Manual Validation Outline**: Instructions on how to trigger the workflow and verify the Cloudflare Zero Trust hostname routing.
