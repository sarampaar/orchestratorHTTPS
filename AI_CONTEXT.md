# AI Context & Architecture Rules
**Purpose:** Provide this document to AI assistants (like Google AI Studio, ChatGPT, or Claude) so they understand the exact deployment architecture of this VPS and can write code/instructions that perfectly integrate with it.

---

## The Orchestrator Architecture

This repository uses a Dockerized, Cloudflare-Tunnel-based architecture on a VPS. It supports two different types of deployments: **Static Sites** and **Dynamic Apps (Node.js/Prisma)**. 

When generating code or deployment instructions for this repository, you **must** follow these specific architectural rules.

### 1. Dynamic Apps (Node/Express/Prisma)
If you are building a Node.js app that requires a backend server or a database (like the Domain Checker), follow this exact flow:

1. **Folder Creation:** Create the app inside a dedicated folder in `apps/` (e.g., `apps/my-new-app/`).
2. **Dockerfile:** Include a standard Node.js Dockerfile inside that specific app folder.
3. **Database (Prisma):**
   - The VPS runs a central PostgreSQL container named `global_postgres`.
   - Add a `prisma/schema.prisma` file inside the app folder.
   - Any `model` defined in Prisma (e.g., `model User`) will automatically become the exact table name (`User`) in the Postgres database.
   - The database connection string must connect through the Docker network: `postgres://admin:password@global_postgres:5432/orchestrator_db`.
4. **Docker Compose Integration:**
   - Add the app as a new service inside the root `docker-compose.yml`.
   - The `container_name` you choose is extremely important (e.g., `container_name: my-new-app`).
   - The `build` path must point to the folder: `build: ./apps/my-new-app`.
5. **Cloudflare Routing:**
   - Do NOT use Nginx for dynamic apps.
   - Because the Cloudflare Tunnel is on the same Docker network (`factory_net`), it can route traffic directly to the container's internal port.
   - To link a domain to this app, the user simply goes to Cloudflare Zero Trust and points the Public Hostname to `http://<container_name>:<port>` (e.g., `http://my-new-app:3000`).

### 2. Static Sites (HTML/CSS/JS)
If you are building a pure frontend static site, the process is incredibly simple. We use a dynamic Nginx routing system. Do NOT create new containers for static sites.

1. **Folder Creation:** Create a folder inside the root `www/` directory. The folder name **must exactly match the domain name**. (e.g., `www/example.com/`).
2. **Assets:** Place the `index.html`, CSS, and JS directly inside that folder.
3. **Cloudflare Routing:**
   - The central Nginx container (`global_nginx`) handles all static routing automatically based on the requested Host header.
   - To link the domain to this static site, the user goes to Cloudflare Zero Trust and points the Public Hostname to `http://global_nginx:80`. 
   - Nginx will automatically see the request for `example.com` and serve the files from the `www/example.com/` folder.

### Deployment Process
All code changes, folder creations, and docker-compose updates are committed and pushed to the `main` branch. A GitHub Action (`sync-infra.yml`) automatically connects to the VPS, syncs the files, and restarts the Docker containers.

**Always remember:** Docker container names are the internal DNS names used by Cloudflare Tunnels!
