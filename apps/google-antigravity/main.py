import os
import uuid
import asyncio
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Google Antigravity Agent Platform",
    description="FastAPI Web Interface for the Google Antigravity autonomous AI agent SDK.",
    version="1.0.0"
)

# Enable CORS for easy cross-origin development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Data Models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class AgentAction(BaseModel):
    timestamp: str
    type: str  # 'info', 'tool_call', 'tool_response', 'success', 'warning'
    message: str

class ChatResponse(BaseModel):
    response: str
    session_id: str
    simulated: bool
    actions: List[dict]

# Simulated Agent Database for demo fallback
SIMULATED_RESPONSES = {
    "hello": "Hello! I am your Antigravity Autonomous Agent. I am ready to scan the codebase, run terminal commands, or help you deploy containers. How can I assist you today?",
    "help": "I can execute a variety of autonomous operations, including:\n1. **Scanning Files**: Reading code files to locate bugs.\n2. **Terminal Execution**: Running compile scripts and testing frameworks.\n3. **Refactoring**: Editing local project files securely.\n\nLet me know what you would like to run!",
    "status": "All systems operating within acceptable parameters. The Antigravity engine is hovering steadily. Port 8000 is open, and routing is established.",
    "list files": "Here are the files currently present in the project workspace root:\n\n- `docker-compose.yml` (Main stack)\n- `apps/` (Application directory)\n- `nginx/` (Reverse proxy layer)\n- `www/` (Static site folders)\n- `.github/workflows/` (CI/CD pipelines)\n\nI can read or edit any of these for you!",
    "deploy": "To deploy a new app, please specify its name and layout. For example, you can tell me: 'Deploy a Node.js database app called logger'."
}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())
    user_message = request.message.strip().lower()
    
    # Check if Gemini API key is configured
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    
    actions_log = []
    
    # ----------------------------------------------------
    # PATH A: Live Antigravity SDK Execution (If API Key Present)
    # ----------------------------------------------------
    if gemini_key:
        actions_log.append({
            "type": "info",
            "message": "🔌 Antigravity Engine: Initializing local agent session..."
        })
        
        try:
            # Dynamically import to ensure runtime safety if library installation is pending
            from google.antigravity import Agent, LocalAgentConfig
            
            actions_log.append({
                "type": "info",
                "message": "🧬 Antigravity Engine: Loading model and context..."
            })
            
            # Formulate the local system instructions
            config = LocalAgentConfig(
                system_instructions=(
                    "You are an expert autonomous AI agent running in a container on the user's VPS. "
                    "You have the capability to assist with code navigation, file read/write, and deployment. "
                    "Always outline your step-by-step thinking process, execute tools responsibly, "
                    "and communicate clearly in professional, technical terms."
                )
            )
            
            actions_log.append({
                "type": "tool_call",
                "message": f"🤖 Agent: Processing user command: '{request.message[:40]}...'"
            })
            
            # Execute actual agentic loop
            async with Agent(config) as agent:
                agent_response = await agent.chat(request.message)
                response_text = await agent_response.text()
                
            actions_log.append({
                "type": "success",
                "message": "✅ Agent session executed successfully. Returning response."
            })
            
            return ChatResponse(
                response=response_text,
                session_id=session_id,
                simulated=False,
                actions=actions_log
            )
            
        except Exception as e:
            # Log error details and pivot to simulation fallback
            actions_log.append({
                "type": "warning",
                "message": f"⚠️ Antigravity SDK Import/Execution error: {str(e)}"
            })
            actions_log.append({
                "type": "info",
                "message": "🔄 Pivoting to Interactive Simulation Engine for demonstration..."
            })
            # Continue to simulation fallback
    
    # ----------------------------------------------------
    # PATH B: Dynamic Simulation Engine (Fallback)
    # ----------------------------------------------------
    actions_log.append({
        "type": "warning",
        "message": "⚠️ API key is not configured. Running agent in high-fidelity simulation mode."
    })
    
    # Simulate a realistic multi-step planning and tool execution loop
    actions_log.append({
        "type": "info",
        "message": "🧠 Agent: Formulating autonomous plan for user prompt..."
    })
    await asyncio.sleep(0.4)
    
    # Custom tool simulations depending on user prompt keywords
    if "file" in user_message or "list" in user_message or "show" in user_message:
        actions_log.append({
            "type": "tool_call",
            "message": "🔧 Executing tool: 'list_dir(path=\"/workspace\")'..."
        })
        await asyncio.sleep(0.6)
        actions_log.append({
            "type": "tool_response",
            "message": "📁 Tool output: Found 8 subdirectories, 12 files. Main files: docker-compose.yml, README.md."
        })
        await asyncio.sleep(0.3)
        simulated_text = SIMULATED_RESPONSES["list files"]
    elif "deploy" in user_message or "create" in user_message or "install" in user_message:
        actions_log.append({
            "type": "tool_call",
            "message": "🔧 Executing tool: 'run_bash(command=\"docker compose ps\")'..."
        })
        await asyncio.sleep(0.5)
        actions_log.append({
            "type": "tool_response",
            "message": "🐳 Tool output: Running services: global_nginx, global_postgres, stalwart-mail, code-server."
        })
        await asyncio.sleep(0.4)
        simulated_text = SIMULATED_RESPONSES["deploy"]
    elif "help" in user_message or "what can you" in user_message:
        simulated_text = SIMULATED_RESPONSES["help"]
    elif "status" in user_message or "health" in user_message:
        actions_log.append({
            "type": "tool_call",
            "message": "🔧 Executing tool: 'run_bash(command=\"uname -a && free -m\")'..."
        })
        await asyncio.sleep(0.4)
        actions_log.append({
            "type": "tool_response",
            "message": "🖥️ Tool output: Linux VPS-Host 6.8.0 #1 SMP Debian, Memory Used: 1240MB / 4096MB."
        })
        await asyncio.sleep(0.2)
        simulated_text = SIMULATED_RESPONSES["status"]
    else:
        # Default conversational chat
        actions_log.append({
            "type": "tool_call",
            "message": "🔧 Executing tool: 'search_codebase(query=\"" + request.message[:20] + "\")'..."
        })
        await asyncio.sleep(0.5)
        actions_log.append({
            "type": "tool_response",
            "message": "🔍 Tool output: Found 2 references to search term in apps/ and workflows/."
        })
        await asyncio.sleep(0.3)
        simulated_text = (
            f"I analyzed your request: '{request.message}'. As an autonomous agent, I can assist with this task! "
            "To connect this interface directly to your active AI models, please navigate to your VPS "
            "environment and set the `GEMINI_API_KEY` inside your deployment secrets. "
            "In the meantime, feel free to try other commands like 'list files', 'status', or 'help' to see my terminal logs in action!"
        )
        if user_message in SIMULATED_RESPONSES:
            simulated_text = SIMULATED_RESPONSES[user_message]
            
    actions_log.append({
        "type": "success",
        "message": "✨ Plan completed. Agent response ready."
    })
    
    return ChatResponse(
        response=simulated_text,
        session_id=session_id,
        simulated=True,
        actions=actions_log
    )

# Serve the static UI files at root
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
