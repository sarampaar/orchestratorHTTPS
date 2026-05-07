# Agentic AI Setup Plan & Instructions

This document provides the complete plan, folder structure, and step-by-step instructions from your side to deploy your local Agentic AI setup within the `orchestratorHTTPS` repo. It utilizes `llama.cpp` for the backend and `Open WebUI` for the frontend.

## 1. Directory Structure
The files are isolated within `apps/agentic_ai/` to keep your codebase clean.

```text
orchestratorHTTPS/
└── apps/
    └── agentic_ai/
        ├── models/         # (Hard disk folder) Place your downloaded .gguf models here.
        └── tools/          # Future agentic modules (PDF parser, YouTube integration).
```

## 2. Model Selection (Strict < 8GB RAM Limit)
You specified a maximum allowance of 8GB RAM. To avoid OOM (Out of Memory) crashes, the model file must be **under 5GB** to allow room for the operating system and model context window.

**Recommended Models to Download:**
- **Qwen 1.5 (7B) or Qwen 2 (7B)**: Look for the `Q4_K_M` GGUF quantization. Size is roughly ~4.3 GB.
- **Gemma (2B or 7B)**: Look for the `Q4_K_M` GGUF quantization.

## 3. Actions from Your Side (Step-by-Step)

### Step A: Download the LLM Model (Directly on VPS)
**CRITICAL:** Do NOT download the 4.3GB `.gguf` model to your local Windows computer and try to push it via Git. GitHub has strict file size limits, and uploading a 5GB file will break your repository. 

You must download the model **directly on the VPS** using SSH:
1. SSH into your VPS (`ssh -p 2256 root@your_vps_ip`).
2. Manually create the required folder structure on your VPS and navigate into it:
   ```bash
   mkdir -p ~/orchestrator/apps/agentic_ai/models
   cd ~/orchestrator/apps/agentic_ai/models
   ```
3. Use `wget` to download the model directly from HuggingFace to the VPS. For example, to download the Qwen 1.5 7B model:
   ```bash
   wget "https://huggingface.co/Qwen/Qwen1.5-7B-Chat-GGUF/resolve/main/qwen1_5-7b-chat-q4_k_m.gguf"
   ```

### Step B: How to Switch Models
You can download as many `.gguf` files into the `models/` folder as you have hard drive space for. 
However, the `llama-server` only runs **one model at a time** to save RAM. 
To tell the server which model to run, follow this 3-step process:

1. **Download the new model:** SSH into your VPS and use `wget` to download your new `.gguf` file into the `~/orchestrator/apps/agentic_ai/models/` folder.
2. **Update the code:** Open `docker-compose.yml` in your editor, find the `agentic_ai_llama_server` section, and change the `--model` command to match your new filename (e.g., `--model /models/Qwen2.5-Math-7B-Instruct-Q4_K_M.gguf`). Commit and push this change to GitHub.
3. **Restart the AI:** Go to your GitHub Actions tab and click **Run workflow** on the `Sync AI Infrastructure` (`ai-infra.yml`) action. The server will automatically restart and load your new model!

### Step C: Deployment Process
This repository follows an automated deployment process. 
1. Since the `agentic_ai_llama_server` and `agentic_ai_webui` services have been added to the root `docker-compose.yml`, they will be deployed automatically by your GitHub Action (`sync-infra.yml`) when you commit and push these changes.
2. Ensure you have SSH'd into the VPS and downloaded your `.gguf` model directly into the `apps/agentic_ai/models/` directory BEFORE pushing, otherwise the llama container will crash on boot looking for the model.
3. If testing locally, you can run `docker-compose up -d agentic_ai_llama_server agentic_ai_webui` from the root directory.

### Step C: Public Access anywhere (Cloudflare Tunnel)
Because this is deployed on your VPS with `restart: always`, it acts exactly like a 24x7 website. You can access the WebUI from your phone, laptop, or anywhere else.
1. Go to your Cloudflare Zero Trust Dashboard.
2. In your Tunnel's Public Hostname settings, create a new route (e.g., `ai.yourdomain.com`).
3. Point the service directly to the container's internal hostname and port: `http://agentic_ai_webui:8080`.

### Step D: Adding Future Modules (PDF, YouTube)
1. In the Web UI, you can connect your own custom tools or create system prompts.
2. We will place custom Python/Node scripts in the `apps/agentic_ai/tools/` folder later. If they require execution, they should be built as independent Docker containers inside `apps/agentic_ai/tools/` and added to the root `docker-compose.yml` to communicate over the `factory_net`.

