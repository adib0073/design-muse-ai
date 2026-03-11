# Architecture

## System Overview

DesignMuse AI uses a multi-agent architecture orchestrated via Google ADK. Each agent is specialized for one stage of the design pipeline.

```
┌──────────────────────────────────────────────────────┐
│                  Frontend (Next.js)                  │
│  FloorPlanUpload │ ThemeSelector │ DesignResults     │
│  VisualizationPanel │ LiveSession                    │
└────────────────────────┬─────────────────────────────┘
                         │ REST API
┌────────────────────────▼─────────────────────────────┐
│               Backend (FastAPI + ADK)                │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │            DesignOrchestrator                  │  │
│  │                                                │  │
│  │  FloorPlanAgent → DesignerAgent → Visualizer  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Services: GeminiService │ ImagenService │ VeoService│
└──────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   Gemini 2.0       Imagen 3          Veo 2
```

## Agent Pipeline

### 1. FloorPlanAgent
- **Input:** Floor plan image (any format)
- **Model:** Gemini 2.0 Flash (multimodal)
- **Output:** Structured JSON with room data (names, dimensions, windows, doors)

### 2. DesignerAgent
- **Input:** Structured room data + theme + optional instructions
- **Model:** Gemini 2.0 Flash + Imagen 3
- **Output:** Complete design with per-room color palettes, furniture, materials, and generated images

### 3. VisualizerAgent
- **Input:** Design output + optional reference images
- **Model:** Imagen 3 + Veo 2
- **Output:** High-quality room renders + walkthrough video

## API Endpoints

| Method | Path | Feature | Description |
|--------|------|---------|-------------|
| POST | `/api/design/generate` | 1 | Analyze floor plan + generate themed design |
| POST | `/api/visualize/render` | 2 | Generate room renders + video |
| POST | `/api/live/start` | 3 | Start live design session |
| POST | `/api/live/message` | 3 | Send modification request |
| GET | `/health` | — | Health check |

## Data Flow

1. User uploads floor plan image + selects theme
2. `FloorPlanAgent` analyzes image → structured room data
3. `DesignerAgent` generates themed design → text + images
4. `VisualizerAgent` renders rooms → images + video
5. Live session allows iterative modifications via chat
