"""Main ADK agent orchestrator that coordinates the design pipeline."""

import uuid

from backend.agents.floor_plan import FloorPlanAgent
from backend.agents.designer import DesignerAgent
from backend.agents.visualizer import VisualizerAgent
from backend.models.schemas import (
    DesignResponse,
    VisualizationResponse,
    LiveSessionResponse,
    LiveSessionStart,
)


class DesignOrchestrator:
    """Coordinates sub-agents through the design pipeline:
    Analyze -> Design -> Render -> Video -> Live Interaction
    """

    def __init__(self):
        self.floor_plan_agent = FloorPlanAgent()
        self.designer_agent = DesignerAgent()
        self.visualizer_agent = VisualizerAgent()
        self._sessions: dict[str, dict] = {}

    async def generate_design(
        self,
        floor_plan_image: bytes,
        theme: str,
        instructions: str = "",
    ) -> DesignResponse:
        """Feature 1: Analyze floor plan and generate themed design."""
        floor_plan_data = await self.floor_plan_agent.analyze(floor_plan_image)

        design = await self.designer_agent.generate(
            floor_plan_data=floor_plan_data,
            theme=theme,
            instructions=instructions,
            floor_plan_image=floor_plan_image,
        )

        return design

    async def render_visualization(
        self,
        floor_plan_image: bytes,
        theme: str,
        room: str = "all",
        reference_images: list[bytes] | None = None,
    ) -> VisualizationResponse:
        """Feature 2: Generate room renders and video walkthrough."""
        floor_plan_data = await self.floor_plan_agent.analyze(floor_plan_image)

        design = await self.designer_agent.generate(
            floor_plan_data=floor_plan_data,
            theme=theme,
            floor_plan_image=floor_plan_image,
        )

        visualization = await self.visualizer_agent.render(
            design=design,
            room=room,
            reference_images=reference_images or [],
        )

        return visualization

    async def start_live_session(
        self,
        floor_plan_image: bytes,
        theme: str,
    ) -> LiveSessionStart:
        """Feature 3: Initialize a live interactive design session."""
        session_id = str(uuid.uuid4())

        design = await self.generate_design(
            floor_plan_image=floor_plan_image,
            theme=theme,
        )

        self._sessions[session_id] = {
            "floor_plan_image": floor_plan_image,
            "theme": theme,
            "current_design": design,
            "history": [],
        }

        return LiveSessionStart(
            session_id=session_id,
            status="active",
            initial_design=design,
        )

    async def handle_live_message(
        self,
        session_id: str,
        user_message: str,
        context: dict | None = None,
    ) -> LiveSessionResponse:
        """Feature 3: Process a live design modification request."""
        session = self._sessions.get(session_id)
        if not session:
            return LiveSessionResponse(
                session_id=session_id,
                agent_message="Session not found. Please start a new session.",
            )

        result = await self.designer_agent.modify_design(
            current_design=session["current_design"],
            user_request=user_message,
            floor_plan_image=session["floor_plan_image"],
        )

        session["current_design"] = result["updated_design"]
        session["history"].append({
            "user": user_message,
            "changes": result["changes"],
        })

        updated_renders = []
        if result.get("affected_rooms"):
            viz = await self.visualizer_agent.render(
                design=result["updated_design"],
                room=",".join(result["affected_rooms"]),
            )
            updated_renders = viz.rooms

        return LiveSessionResponse(
            session_id=session_id,
            agent_message=result["agent_message"],
            updated_renders=updated_renders,
            design_changes=result["changes"],
        )
