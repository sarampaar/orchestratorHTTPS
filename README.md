# Orchestrator HTTPS Layer

## Overview
> [!NOTE]
> The Nginx server (`global_nginx:80`)is intended to be temporary or primarily for serving static sites. If a Node.js framework is used, the Next.js container (e.g., `nextjs_demo:3000`) will take care of the traffic directly via Cloudflare Tunnels.

This repository serves as the **single source of truth** for all web applications hosted on the VPS. It automates the deployment of a highly scalable, dynamic Nginx architecture securely connected via Cloudflare Tunnels. 

The primary goal is to achieve a secure `200 OK` HTTP/HTTPS response for infinite domains with near-zero downtime, seamlessly integrating GoDaddy domains, Cloudflare security, and GitHub Actions.

---

## 🏗️ Architecture Pipeline

The traffic flow and management pipeline follows this structure:

1. **GoDaddy**: Domain registration and nameserver delegation.
2. **Cloudflare**: DNS management, SSL/HTTPS termination, and Zero Trust Tunnels.
3. **GitHub Actions**: Single source of truth for infrastructure configuration, Nginx routing, and website HTML content.
4. **VPS (Ubuntu 24.04 LTS)**: Hosts the Dockerized Nginx server and Cloudflared Tunnel daemon.

---

## 🔑 Step 1: VPS SSH Key Generation & Authorization

Before doing anything else, you must create and authorize an SSH key on your new VPS so GitHub Actions can securely connect to it. Run these commands on your VPS terminal:

*** NOTE:/ id_github_actions is folder name acutal used is id_rsa_org ***
```bash
# 1. Generate an SSH Key (leave the passphrase empty)
ssh-keygen -t ed25519 -f ~/.ssh/id_github_actions -N ""

# 2. Authorize the Key by appending it to authorized_keys
cat ~/.ssh/id_github_actions.pub >> ~/.ssh/authorized_keys

# 3. Set Strict Permissions for security
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# 4. Retrieve Private Key
cat ~/.ssh/id_github_actions
```
*Securely copy the entire output block (including the `BEGIN` and `END` headers) to save for the next step.*

---

## 🔐 Step 2: Initial GitHub Secrets Configuration

Now that your SSH key is authorized, define the following **Organization Level Secrets** in GitHub so your Actions can securely log into your VPS:

- `GLOBAL_VPS_IP`: The public IP address of your VPS.
- `GLOBAL_VPS_PORT`: The SSH port for your VPS (defaults to `2256` if not set).
- `GLOBAL_VPS_SSH_KEY` (or `GLOBAL_SSH_KEY`): Paste the SSH Private Key output you copied from Step 1 here.

---

## 🛠️ Step 3: VPS Diagnostics & Health Checklist

With the SSH keys in place, you can now run your first GitHub Action to verify your VPS is healthy.
- Navigate to the **Actions** tab in GitHub.
- Run the **VPS Diagnostics** (`vps-diagnostics.yml`) workflow.
- Review the output report saved in the `action_response/` folder against this checklist:

### Diagnostic Verification Checklist:
- [ ] **Docker Engine**: Verify Docker is installed, running, and returning system info.
- [ ] **PostgreSQL Database**: Check that the `global_postgres` container is running without restart loops.
- [ ] **Cloudflared Service**: Confirm the `cloudflared` CLI is installed and the background service is active.
- [ ] **Container Conflicts**: Ensure there are no old, conflicting tunnel or nginx containers running.
- [ ] **Network & Ports**: Check the `ss`/`netstat` output to ensure the VPS is listening on your designated SSH port.
- [ ] **Firewall (UFW)**: Verify your firewall status is active and properly configured to allow necessary SSH traffic.

---

## 🚀 Step 4: Domain & Tunnel Setup (Manual)

Now we connect the networking layer to your VPS. Follow these sequential steps:

1. **Cloudflare DNS**: Add your new domain to Cloudflare to get your assigned Cloudflare Nameservers.
2. **GoDaddy**: Update the domain's nameservers in GoDaddy to point to the Cloudflare Nameservers. Wait for the domain status to become "Active" in Cloudflare.
3. **Cloudflare Zero Trust**:
   - Go to **Zero Trust** -> **Access** -> **Tunnels**.
   - Create a new Tunnel (Select Debian/Linux environment).
   - *If cloudflared is not installed on the VPS*, run the provided installation command on your VPS.
   - Copy **only** the `CONNECTOR TOKEN`.
4. **Final Secret**: Add the Connector Token to your GitHub Secrets as `CF_TUNNEL_TOKEN`.
5. **Public Hostname Routing**:
   - In your Cloudflare Tunnel settings, add a Public Hostname for your domain (e.g., `example.com` or `app.example.com`).
   - Set the Service Type to `HTTP` and the URL to `global_nginx:80`.

---

## 🌐 Step 5: Adding Websites & Content (Single Source of Truth)

This repository utilizes a **Dynamic Nginx Routing** configuration (`nginx/conf.d/default.conf`). Nginx dynamically routes incoming traffic to a specific folder in `/var/www/` based on the exact HTTP Host Header requested. 

**There is no need to write a new Nginx `.conf` file for every domain!**

### How to add a new Domain or Subdomain:
1. Create a new folder inside the `www/` directory of this repository that **exactly matches** the hostname.
   - Example for a domain: `www/example.com/`
   - Example for a subdomain: `www/app.example.com/`
2. Place your `index.html` and other static assets inside that folder.
3. Commit and push your changes to GitHub.

### Fallback Behavior:
If a domain is routed via Cloudflare but does not have a matching folder in `www/`, Nginx will automatically serve the generic welcome page from the `www/default/` directory.

---

## ⚙️ Step 6: Deployment & Sync

All updates are deployed securely and automatically via GitHub Actions. 

Navigate to the **Actions** tab in this repository and run the **Sync Infrastructure** (`sync-infra.yml`) workflow.
**Run this whenever you add new domains, update HTML files, or change Nginx configurations.**
- Securely connects to the VPS.
- Copies the `docker-compose.yml`, `nginx/conf.d/` routing rules, and the entire `www/` website directory to the VPS.
- Boots or updates the Docker containers (`global_nginx` and `tunnel`).

---

## ⚡ Step 7: Node.js + Prisma SSG Pipeline
This architecture includes a built-in **Static Site Generator (SSG)** workflow for database-driven websites.
Because your PostgreSQL database is securely hidden inside the VPS, GitHub Actions cannot connect to it directly. Instead, when you deploy:
1. The GitHub Action copies your SSG source code (in `ssg-builder/`) to your VPS.
2. The Action spins up a temporary **Node.js 18 Docker Container** right on your VPS.
3. This container securely connects to the database locally, executes Prisma to fetch data, generates the static HTML files, and outputs them directly to your `www/` directory.
4. The temporary container deletes itself, leaving Nginx to serve the site incredibly fast.

---

## 📊 Step 8: Database Administration (Adminer)
You can visually manage your PostgreSQL data using the built-in **Adminer** service. This is completely hidden from the public internet for maximum security.

**How to access your Admin Panel:**
1. Go to your **Cloudflare Tunnel** settings.
2. Add a new Public Hostname route (e.g., `admin.example.com`).
3. Set the Service Type to `HTTP` and the URL to `db_admin:8080`.
4. Visit `admin.example.com` in your browser.
5. Log in using the following details:
   - **System**: PostgreSQL
   - **Server**: `global_postgres`
   - **Username**: The `POSTGRES_USER` from your secrets.
   - **Password**: The `POSTGRES_PASSWORD` from your secrets.
   - **Database**: `orchestrator_db`

---

## 🚀 Step 9: Dynamic Applications (SSR / ISR / SPA)
The Orchestrator isn't just for static sites! If you want to run a fully dynamic Node.js, Next.js, or Nuxt application, you can bypass Nginx completely.

### The Architecture:
Because we use Cloudflare Tunnels, Cloudflare acts as the ultimate reverse proxy.
1. You place your app code inside the `apps/` directory (e.g., `apps/nextjs-demo`).
2. You add a simple `Dockerfile` to that folder.
3. You add it as a new service in your `docker-compose.yml`.
4. When you deploy, the app spins up internally on the `factory_net` (e.g., port `3000`).

### How to Route Traffic:
Instead of dealing with Nginx `.conf` files, you just go to Cloudflare Zero Trust:
1. Create a new Public Hostname (e.g., `dynamic.theengineer.co.in`).
2. Set the Service Type to `HTTP` and the URL to `nextjs_demo:3000`.
3. Cloudflare will securely tunnel traffic directly into your Next.js container!

This brilliantly separates your ultra-fast Static Sites (handled automatically by Nginx) from your complex Dynamic Apps (handled directly by Cloudflare Tunnels).