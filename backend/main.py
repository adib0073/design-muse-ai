import json
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.agents.orchestrator import DesignOrchestrator
from backend.models.schemas import (
    LiveSessionMessage,
    LiveSessionResponse,
)
from backend.services.storage import StorageService

load_dotenv()

storage: StorageService | None = None
orchestrator: DesignOrchestrator | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global storage, orchestrator
    storage = StorageService()
    orchestrator = DesignOrchestrator()
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("generated/images", exist_ok=True)
    os.makedirs("generated/videos", exist_ok=True)
    yield


app = FastAPI(
    title="DesignMuse AI",
    description="AI-Powered Interior Design Agent",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/generated", StaticFiles(directory="generated"), name="generated")


def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# Feature 1: Theme-Based Design Generation (SSE stream)
# ---------------------------------------------------------------------------
@app.post("/api/design/generate")
async def generate_design(
    floor_plan: UploadFile = File(...),
    theme: str = Form(...),
    additional_instructions: str = Form(""),
):
    """Stream design generation: first the text plan, then images one-by-one."""
    if not floor_plan.content_type or not floor_plan.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Floor plan must be an image file.")

    image_bytes = await floor_plan.read()

    async def event_stream():
        async for event in orchestrator.generate_design_stream(
            floor_plan_image=image_bytes,
            theme=theme,
            instructions=additional_instructions,
        ):
            yield _sse(event)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Feature 2: Video Walkthrough (SSE stream with progress)
# ---------------------------------------------------------------------------
class WalkthroughRequest(BaseModel):
    image_urls: list[str]


@app.post("/api/visualize/walkthrough")
async def create_walkthrough(request: WalkthroughRequest):
    """Stream walkthrough video generation with per-clip progress."""

    async def event_stream():
        async for event in orchestrator.create_walkthrough_stream(
            image_urls=request.image_urls,
        ):
            yield _sse(event)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Feature 3: Live Interactive Design Session
# ---------------------------------------------------------------------------
@app.post("/api/live/message", response_model=LiveSessionResponse)
async def live_session_message(message: LiveSessionMessage):
    """Send a message in a live design session and receive updated visuals."""
    result = await orchestrator.handle_live_message(
        session_id=message.session_id,
        user_message=message.message,
        context=message.context,
    )
    return result


@app.post("/api/live/start")
async def start_live_session(
    floor_plan: UploadFile = File(...),
    theme: str = Form(...),
):
    """Start a new live interactive design session."""
    image_bytes = await floor_plan.read()
    session = await orchestrator.start_live_session(
        floor_plan_image=image_bytes,
        theme=theme,
    )
    return session


class ConfirmChangeRequest(BaseModel):
    room_name: str
    new_image_url: str


@app.post("/api/live/confirm")
async def confirm_live_change(request: ConfirmChangeRequest):
    """Confirm a live session change — updates the stored design's room image."""
    success = orchestrator.update_design_room_image(
        room_name=request.room_name,
        new_image_url=request.new_image_url,
    )
    return {"success": success}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "designmuse-api"}
