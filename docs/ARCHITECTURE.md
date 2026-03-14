# Architecture

## System Overview

DesignMuse AI uses a multi-agent architecture with specialized agents for each stage of the design pipeline. All models are accessed via Google Cloud Vertex AI.

[![Architecture](../frontend/public/high_level_design.jpg)](../frontend/public/high_level_design.jpg)

## Models Used

| Model | ID | Location | Purpose |
|---|---|---|---|
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | `us-central1` | Floor plan analysis, design generation (JSON), live session text responses |
| **Gemini 2.5 Flash Image** | `gemini-2.5-flash-image` | `global` | Image editing (modify existing room renders in-place) |
| **Gemini 3.1 Flash Image** | `gemini-3.1-flash-image-preview` | `global` | Fallback image editing model |
| **Imagen 3** | `imagen-3.0-fast-generate-001` | `us-central1` | Primary text-to-image room render generation |
| **Veo 3.1** | `veo-3.1-fast-generate-001` | `us-central1` | Image-to-video clip generation for walkthroughs |

## Two GenAI Clients

The backend uses two separate GenAI client instances:

- **`get_client()`** — Location: `us-central1` (or configured). Used for Gemini text/JSON, Imagen, and Veo models that are region-specific.
- **`get_image_client()`** — Location: `global`. Used for Gemini image generation/editing models (`gemini-*-image*`) that require the global endpoint.

## Agent Pipeline

### 1. FloorPlanAgent
- **Input:** Floor plan image (any format)
- **Model:** Gemini 2.5 Flash (multimodal)
- **Output:** Structured JSON with room/space data (names, approximate dimensions, features)

### 2. DesignerAgent
- **Input:** Structured room data + theme + optional instructions
- **Models:** Gemini 2.5 Flash (text/JSON) + Imagen 3 (renders)
- **Output:** Complete design with per-room color palettes, furniture, materials, and generated images
- **Streaming:** Design text arrives first, then room images stream one-by-one via SSE
- **Live session:** `modify_design()` accepts user request + optional reference image, returns affected rooms with preserved image URLs

### 3. VisualizerAgent
- **Input:** Design output with generated room images
- **Models:** Gemini 2.5 Flash Image (editing) + Imagen 3 (fallback generation) + Veo 3.1 (video)
- **Image editing strategy (3-tier fallback):**
  1. Edit existing image with Gemini Image (preserves original composition)
  2. Regenerate with Imagen using full room description + changes
  3. Keep original image as last resort
- **Video generation:** Each room image → individual Veo clip → FFmpeg stitches all clips into one walkthrough

## API Endpoints

| Method | Path | Streaming | Description |
|---|---|---|---|
| `POST` | `/api/design/generate` | SSE | Analyze floor plan + generate themed design (text, then images) |
| `POST` | `/api/visualize/walkthrough` | SSE | Generate walkthrough video (progress per clip, then final URL) |
| `POST` | `/api/live/start` | No | Start live design session with floor plan + theme context |
| `POST` | `/api/live/message` | No | Send text/image modification request (multipart form) |
| `POST` | `/api/live/confirm` | No | Confirm live session changes back to the main design |
| `GET` | `/health` | No | Health check |

## Data Flow

### Design Generation (SSE Stream)
1. User uploads floor plan image + selects theme
2. `FloorPlanAgent` analyzes image → structured room data
3. `DesignerAgent` generates themed design text → SSE event `design_text`
4. For each room, Imagen 3 generates a render → SSE event `room_image` (progressive)
5. SSE event `complete` when all images are done

### Live Session
1. User starts session → server loads existing design + floor plan into context
2. User sends text/voice message (+ optional reference image)
3. `DesignerAgent.modify_design()` determines affected rooms and changes
4. `VisualizerAgent.render_rooms_only()` edits existing room images
5. Response includes updated renders; user can confirm to apply to main design

### Video Walkthrough (SSE Stream)
1. Loads existing room images from design
2. For each room, Veo 3.1 generates a short video clip → SSE event `progress`
3. FFmpeg concatenates all clips → SSE event `stitching`
4. Final video URL → SSE event `complete`

## Frontend Components

| Component | Purpose |
|---|---|
| `Header` | App branding with DesignMuse logo |
| `FloorPlanUpload` | Drag-and-drop floor plan image upload |
| `ThemeSelector` | Theme selection (preset grid + custom input) |
| `DesignResults` | Progressive room-by-room design display with lightbox |
| `LiveSession` | Chat interface with text, voice (Web Speech API), image upload, and confirm flow |
| `VisualizationPanel` | Video generation with per-clip progress bar and fullscreen playback |
