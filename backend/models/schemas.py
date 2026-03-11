from pydantic import BaseModel, Field


class RoomDesign(BaseModel):
    room_name: str
    description: str
    color_palette: list[str] = Field(description="Hex color codes")
    furniture_suggestions: list[str]
    decoration_suggestions: list[str]
    materials: list[str]
    generated_image_url: str | None = None


class DesignRequest(BaseModel):
    theme: str
    additional_instructions: str = ""


class DesignResponse(BaseModel):
    theme: str
    floor_plan_analysis: str
    rooms: list[RoomDesign]
    mood_board_url: str | None = None
    overall_style_notes: str = ""


class VisualizationRequest(BaseModel):
    theme: str
    room: str = "all"


class RoomRender(BaseModel):
    room_name: str
    render_url: str
    description: str


class VisualizationResponse(BaseModel):
    rooms: list[RoomRender]
    video_url: str | None = None
    status: str = "completed"


class LiveSessionMessage(BaseModel):
    session_id: str
    message: str
    context: dict = Field(default_factory=dict)


class LiveSessionResponse(BaseModel):
    session_id: str
    agent_message: str
    updated_renders: list[RoomRender] = Field(default_factory=list)
    design_changes: list[str] = Field(default_factory=list)


class LiveSessionStart(BaseModel):
    session_id: str
    status: str = "active"
    initial_design: DesignResponse | None = None
