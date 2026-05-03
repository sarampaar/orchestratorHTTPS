# orchestratorHTTPS
HTTP/HTTPS Layer
Output - Getting 200 response from domain
Existing- Godady domains, VPS linux headless 24.04 LTS 12gb ram 250gb ssd Hosting, in VPS Cloudflare and docker installed, Cloudflare free Plan Domain and ZeroTrust, Github organization Level GLOBAL_VPS_IP, GLOBAL_VPS_SSH_KEY, CF_TUNNEL_TOKEN
Process - Manual- sequence important - cloudflare add domain names get NAME SERVER, goto godaddy update name server, go to cloudflare check status pending, once active goto zero trust -> access -> tunnels ->   click create tunnel (which is on top right corner) -> create tunnel -> select linux(debian), OPTIONAL IF VPS HAS cloudflared installed (copy command from cloudflare and paste in server, for ubuntu 22.04 LTS:  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb | sudo dpkg -i -)), after cloudflared installed/running on VPS , Copy only CONNECTOR TOKEN from cloudflare tunnel setup. 
goto VPS create ssh key (if not exists) use following commands in termial for ssh private key generation and publick key chmod 

After getting SSHKEY, CF TOKEN PASTE In github organization secrets (GLOBAL_VPS_SSH_KEY, CF_TUNNEL_TOKEN)

Now this task could be done using ansible script.
Task a) This codes runs on github actionsfirst check on manual click -VPS Connection, Cloudflare, Docker checks, CHECK VPS Which port are allowed
connect via git secrets GLOBAL_VPS_PORT, GLOBAL_VPS_IP, GLOBAL_VPS_SSH_KEY, CF_TUNNEL_TOKEN
 
create a folder in repo name as action response , whenever a action runs it will save response in this folder.
