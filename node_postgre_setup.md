# Fresh Node.js + PostgreSQL App Setup Guide

This guide covers the steps to deploy the clean `node_postgresql` app we created. The application is completely isolated in its own schema (`node_postgresql`) so it won't conflict with your previous `aeiou` attempts or the `domain_checker` tables.

## 1. Start the New App
Since the code has already been written and automatically added to your `docker-compose.yml`, all you need to do is build and start it on your VPS.

Run this command from your main orchestrator folder on your VPS:
```bash
cd ~/orchestrator
docker compose up -d --build node_postgresql
```

*What happens in the background?*
Docker will download the Node.js image, install Prisma, run `npx prisma db push` to safely create your `User` and `VisitorStat` tables, and finally start the server on internal port 3000.

## 2. Verify It Works
You can view the startup logs to confirm it connected properly to the database:
```bash
docker logs node_postgresql
```
You should see messages stating that Prisma generated the client and the server is running on port 3000.

## 3. Setup Cloudflare Tunnel
Now you need to expose your new app to the public internet using your existing Cloudflare Tunnel setup.

1. Go to your **Cloudflare Zero Trust Dashboard**.
2. Navigate to **Networks > Tunnels** and click on your active tunnel.
3. Go to the **Public Hostname** tab and click **Add a public hostname**.
4. Configure it as follows:
   * **Subdomain:** `nodeapp` (or whatever you prefer)
   * **Domain:** Choose your domain from the dropdown
   * **Service Type:** `HTTP`
   * **URL:** `node_postgresql:3000`
5. Click **Save hostname**.

## 4. Test the App
Open your browser and navigate to the subdomain you just created (e.g., `https://nodeapp.yourdomain.com`). 

You should see a JSON response showing a "success" message, your total visitor count (which will increase every time you refresh), and the total number of users in your fresh database!
