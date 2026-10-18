"""
SignalBridge - Emergency Copilot FastAPI Backend
------------------------------------------------
Serves the Operator Dashboard, sample calls, landmark resolution,
and the real-time AI triage extraction API for 108/112 helplines.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from app.extractor import extract_incident_card, load_json_file, BASE_DIR

app = FastAPI(
    title="SignalBridge - Emergency AI Copilot",
    description="Real-time incident paperwork, triage, landmark resolution, and first-aid copilot for 108/112 operators",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static directory for frontend assets
static_dir = os.path.join(BASE_DIR, "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Request Schemas
class AnalyzeRequest(BaseModel):
    text: str
    caller_name: Optional[str] = "Anonymous Caller"
    caller_phone: Optional[str] = "Line 108"

# Web Endpoints
@app.get("/")
def read_root():
    """Serves the Operator Dashboard UI."""
    index_file = os.path.join(BASE_DIR, "templates", "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "status": "online",
        "system": "SignalBridge Emergency Copilot"
    }

@app.get("/api/health")
def health_check():
    """Health check for system heartbeat."""
    return {"status": "ok", "app": "SignalBridge", "version": "1.0.0"}

@app.get("/api/sample-calls")
def get_sample_calls() -> List[Dict[str, Any]]:
    """Returns curated demo emergency calls (Cardiac, Tanglish Road Accident, Fire)."""
    calls = load_json_file("sample_calls.json")
    return calls

@app.get("/api/landmarks")
def get_landmarks() -> List[Dict[str, Any]]:
    """Returns registered landmarks and geographical coordinates."""
    landmarks = load_json_file("landmarks.json")
    return landmarks

@app.post("/api/analyze-text")
def analyze_text(payload: AnalyzeRequest) -> Dict[str, Any]:
    """
    Extracts triage data, resolves landmarks, suggests responder,
    and returns vetted first-aid guidance from emergency call transcript.
    """
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Transcript text cannot be empty.")

    incident_card = extract_incident_card(payload.text)
    incident_card["caller_info"] = {
        "name": payload.caller_name,
        "phone": payload.caller_phone
    }
    return incident_card

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
