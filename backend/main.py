import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.agents.orchestrator import DesignOrchestrator
from backend.models.schemas import (
    DesignRequest,
    DesignResponse,
    VisualizationRequest,
    VisualizationResponse,
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


# ---------------------------------------------------------------------------
# Feature 1: Theme-Based Design Generation
# ---------------------------------------------------------------------------
@app.post("/api/design/generate", response_model=DesignResponse)
async def generate_design(
    floor_plan: UploadFile = File(...),
    theme: str = Form(...),
    additional_instructions: str = Form(""),
):
    """Analyze a floor plan and generate themed design recommendations."""
    if not floor_plan.content_type or not floor_plan.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Floor plan must be an image file.")

    image_bytes = await floor_plan.read()
    result = await orchestrator.generate_design(
        floor_plan_image=image_bytes,
        theme=theme,
        instructions=additional_instructions,
    )
    return result


# ---------------------------------------------------------------------------
# Feature 2: Personalized Video Visualization
# ---------------------------------------------------------------------------
@app.post("/api/visualize/render", response_model=VisualizationResponse)
async def render_visualization(
    floor_plan: UploadFile = File(...),
    theme: str = Form(...),
    room: str = Form("all"),
    reference_images: list[UploadFile] = File(default=[]),
):
    """Generate room renders and video walkthrough with user-provided references."""
    floor_plan_bytes = await floor_plan.read()
    ref_images_bytes = [await img.read() for img in reference_images]

    result = await orchestrator.render_visualization(
        floor_plan_image=floor_plan_bytes,
        theme=theme,
        room=room,
        reference_images=ref_images_bytes,
    )
    return result


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


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "designmuse-api"}
