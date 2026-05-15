# Standalone AI Studio App Deployment Guide

Since you want to keep the repositories separate (as they are automatically pushed by AI Studio), you do **not** need to merge them into the mono-repo. Instead, you can have a simple `.github/workflows/deploy.yml` in each AI Studio repository that pushes code directly to your VPS and starts a standalone container.

## 1. How the Architecture Works for Standalone Repos
*   **Existing VPS Infrastructure**: Your VPS already runs `factory_net` (the Docker network), `global_postgres`, and the Cloudflare `tunnel`.
*   **The AI Studio Repo**: Contains your Node.js/Prisma code.
*   **The Deployment**: The GitHub Action in the AI Studio repo SSH's into your VPS, copies the files to a unique folder (e.g., `~/ai-apps/my_app_name`), and runs `docker compose up -d` specifically for that app.
*   **Network Connection**: The app's `docker-compose.yml` is configured to connect to the external `factory_net` network, allowing it to talk to the database and allowing Cloudflare Tunnel to talk to it.

---

## 2. Secrets Required in the AI Studio GitHub Repo
You only need to add these **4 to 5 secrets** to the normal GitHub account repository (Settings > Secrets and variables > Actions):
*   `GLOBAL_VPS_IP`: The IP address of your VPS.
*   `GLOBAL_VPS_SSH_PORT`: The SSH port of your VPS (e.g., `2256`).
*   `GLOBAL_SSH_KEY`: The SSH private key to access the VPS.
*   `POSTGRES_USER`: (Optional) Your database user.
*   `POSTGRES_PASSWORD`: (Optional) Your database password.

---

## 3. Handling the Database in AI Studio (Dev vs Production)

Since exposing your VPS PostgreSQL database (port 5432) to the internet is a security risk, you should use a different database while coding inside Google AI Studio. 

Because Prisma does not allow dynamic database providers (you cannot use a variable to switch between SQLite and PostgreSQL), you have two safe alternatives:

### Alternative A: The SQLite Swap Method (Recommended for simple apps)
Tell Google AI Studio to build your app using `sqlite` for local development. Then, your `Dockerfile` on the VPS will automatically swap it to `postgresql` right before deploying.
* **In AI Studio (`.env`)**: `DATABASE_URL="file:./dev.db"`
* **In AI Studio (`schema.prisma`)**: `provider = "sqlite"`
* **In your `Dockerfile`**: Add a command to swap the provider during the production build (see the updated Dockerfile below).

### Alternative B: Free Serverless Postgres (Recommended for complex apps)
Since SQLite doesn't support some advanced PostgreSQL features (like Enums or JSONB), the easiest seamless method is to use a free remote Postgres database (like [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com)) purely for development in AI Studio.
* **In AI Studio (`.env`)**: `DATABASE_URL="postgres://user:pass@ep-cool-cloud-db.neon.tech/neondb"`
* **In Production**: Your `docker-compose.yml` overrides the `DATABASE_URL` to use your secure, local `global_postgres` VPS database.

---

## 4. Instructions for Google AI Studio (Copy & Paste this to AI Studio)

*You can paste the following prompt directly into Google AI Studio so it knows exactly how to structure your project:*

> **Prompt for Google AI Studio:**
> "I want to deploy this Node.js/Prisma application to a VPS using Docker. Please create or update the following files in the repository:
> 
> **1. `Dockerfile`**
> Create a Dockerfile that uses `node:20-slim` (Debian-based) to avoid Prisma OpenSSL errors. It must run `npm install`, generate the Prisma client (`npx prisma generate`), run the build step if required (`npm run build`), and expose port `3000`. The CMD should start the app (e.g., `npm start`).
> 
> **2. `docker-compose.yml`**
> Create a `docker-compose.yml` file with a single service.
> - The `container_name` MUST be a unique identifier for this app (e.g., `my_ai_app`).
> - It MUST connect to an external network named `factory_net`.
> - It MUST have environment variables: `DATABASE_URL=postgres://${POSTGRES_USER:-admin}:${POSTGRES_PASSWORD:-securepassword123}@global_postgres:5432/orchestrator_db?schema=my_ai_app`.
> - Do NOT expose external ports (no `ports: ["3000:3000"]`).
> 
> **3. `.github/workflows/deploy.yml`**
> Create a GitHub Actions workflow that triggers on push to the main branch. The file MUST be placed inside the `.github/workflows/` directory. The workflow should use `appleboy/scp-action` to copy the repository files to `~/ai-apps/my_ai_app` on the VPS. Then, it should use `appleboy/ssh-action` to run `docker compose up -d --build` in that directory. Assume the secrets `GLOBAL_VPS_IP`, `GLOBAL_VPS_SSH_PORT`, `GLOBAL_SSH_KEY`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` will be provided. The SSH and SCP actions MUST use `port: ${{ secrets.GLOBAL_VPS_SSH_PORT }}` instead of the default port 22."

---

## 4. The Exact Files Google AI Studio Should Create

If you prefer to create them yourself, here are the exact files that need to exist in your standalone repository:

### File 1: `Dockerfile`
*(Where the NPM build happens, including the SQLite -> Postgres swap)*
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# If you used SQLite in AI Studio, this line swaps it to PostgreSQL for production
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/g' prisma/schema.prisma

# If you have a build script (like Next.js or TS), it happens here:
# RUN npm run build
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "start"]
```

### File 2: `docker-compose.yml`
*(Maintains the container name and connects to the global network)*
```yaml
services:
  my_ai_app: # Change this to your app's unique name
    container_name: my_ai_app # This is the name Cloudflare Tunnel will look for
    build: .
    restart: always
    environment:
      - DATABASE_URL=postgres://${POSTGRES_USER:-admin}:${POSTGRES_PASSWORD:-securepassword123}@global_postgres:5432/orchestrator_db?schema=my_ai_app
    networks:
      - factory_net

networks:
  factory_net:
    external: true # Crucial: tells Docker this network is managed by your main VPS orchestrator
```

### File 3: `.github/workflows/deploy.yml`
*(The GitHub Action that deploys it)*
```yaml
name: Deploy App to VPS

on:
  push:
    branches:
      - main # or master

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Prep VPS Directory
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.GLOBAL_VPS_IP }}
          username: root
          key: ${{ secrets.GLOBAL_SSH_KEY }}
          port: ${{ secrets.GLOBAL_VPS_SSH_PORT }}
          script: |
            mkdir -p ~/ai-apps/my_ai_app

      - name: Copy files to VPS
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.GLOBAL_VPS_IP }}
          username: root
          key: ${{ secrets.GLOBAL_SSH_KEY }}
          port: ${{ secrets.GLOBAL_VPS_SSH_PORT }}
          source: "."
          target: "~/ai-apps/my_ai_app"

      - name: Build and Start Docker Container
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.GLOBAL_VPS_IP }}
          username: root
          key: ${{ secrets.GLOBAL_SSH_KEY }}
          port: ${{ secrets.GLOBAL_VPS_SSH_PORT }}
          script: |
            cd ~/ai-apps/my_ai_app
            export POSTGRES_USER=${{ secrets.POSTGRES_USER }}
            export POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
            docker compose up -d --build
```

---

## 5. How Cloudflare Connects to This

Once this GitHub Action finishes, your container `my_ai_app` will be running on your VPS and attached to `factory_net`. 

Because your Cloudflare `tunnel` container is *also* on `factory_net`, it can securely talk directly to your app.

In the **Cloudflare Zero Trust Dashboard**, you will simply create a Public Hostname pointing to:
*   **Service URL:** `http://my_ai_app:3000`

*(Cloudflare uses the `container_name` from your `docker-compose.yml` to route the traffic, so ensuring that name matches is critical).*
