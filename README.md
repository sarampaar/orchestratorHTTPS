# orchestratorHTTPS
HTTP/HTTPS Layer
Output - Getting 200 response from domain
Existing- Godady domains, VPS linux headless 24.04 LTS 12gb ram 250gb ssd Hosting, in VPS Cloudflare and docker installed, Cloudflare free Plan Domain and ZeroTrust, Github organization Level GLOBAL_VPS_IP, GLOBAL_VPS_SSH_KEY, CF_TUNNEL_TOKEN
Process - Manual- sequence important - cloudflare add domain names get NAME SERVER, goto godaddy update name server, go to cloudflare check status pending, once active goto zero trust -> access -> tunnels ->   click create tunnel (which is on top right corner) -> create tunnel -> select linux(debian), OPTIONAL IF VPS HAS cloudflared installed (copy command from cloudflare and paste in server, for ubuntu 22.04 LTS:  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb | sudo dpkg -i -)), after cloudflared installed/running on VPS , Copy only CONNECTOR TOKEN from cloudflare tunnel setup. 
goto VPS create ssh key (if not exists) by running the following commands in the terminal:

```bash
# 1. Ensure the .ssh folder exists
mkdir -p ~/.ssh

# 2. Add your existing public key to authorized_keys so GitHub can log in
cat ~/id_rsa_org.pub >> ~/.ssh/authorized_keys

# 3. Secure the folder and the authorized_keys file
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# 4. Display the private key so you can copy it
cat ~/id_rsa_org
```

```bash
# 1. Generate a new SSH key (leave passphrase empty)
ssh-keygen -t ed25519 -f ~/.ssh/id_github_actions -N ""

# 2. Add the public key to authorized_keys to allow login
cat ~/.ssh/id_github_actions.pub >> ~/.ssh/authorized_keys

# 3. Set the correct permissions for SSH to work
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# 4. Display the private key so you can copy it
cat ~/.ssh/id_github_actions
```

**IMPORTANT**: When copying the private key output from the terminal, ensure you copy the **entire block**, including the `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines. Paste it exactly as is into your GitHub Secrets to preserve the line breaks.

After getting the SSHKEY and CF TOKEN, PASTE them into your GitHub organization secrets (`GLOBAL_VPS_SSH_KEY`, `CF_TUNNEL_TOKEN`).
Now this task could be done using ansible script.
Task a) This codes runs on github actionsfirst check on manual click -VPS Connection, Cloudflare, Docker checks, CHECK VPS Which port are allowed
connect via git secrets GLOBAL_VPS_PORT, GLOBAL_VPS_IP, GLOBAL_VPS_SSH_KEY, CF_TUNNEL_TOKEN
 
create a folder in repo name as action response , whenever a action runs it will save response in this folder.
