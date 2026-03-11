"""Main ADK agent orchestrator that coordinates the design pipeline."""

import uuid
from collections.abc import AsyncGenerator

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
        self._last_design: DesignResponse | None = None
        self._last_floor_plan: bytes | None = None

    async def generate_design_stream(
        self,
        floor_plan_image: bytes,
        theme: str,
        instructions: str = "",
    ) -> AsyncGenerator[dict, None]:
        """Stream design generation: first the text, then images one-by-one.

        Yields dicts with a 'type' key:
          - {"type": "design_text", "data": <DesignResponse dict without images>}
          - {"type": "room_image", "data": {"room_name": "...", "image_url": "..."}}
          - {"type": "complete"}
          - {"type": "error", "message": "..."}
        """
        try:
            floor_plan_data = await self.floor_plan_agent.analyze(floor_plan_image)

            design = await self.designer_agent.generate_text(
                floor_plan_data=floor_plan_data,
                theme=theme,
                instructions=instructions,
                floor_plan_image=floor_plan_image,
            )

            yield {"type": "design_text", "data": design.model_dump()}

            for room in design.rooms:
                image_url = await self.designer_agent.generate_room_image(room, theme)
                room.generated_image_url = image_url
                if image_url:
                    yield {
                        "type": "room_image",
                        "data": {"room_name": room.room_name, "image_url": image_url},
                    }

            self._last_design = design
            self._last_floor_plan = floor_plan_image

            yield {"type": "complete"}

        except Exception as e:
            print(f"Design stream error: {e}")
            yield {"type": "error", "message": str(e)}

    async def create_walkthrough_stream(
        self,
        image_urls: list[str],
    ) -> AsyncGenerator[dict, None]:
        """Stream walkthrough generation progress.

        Yields dicts:
          - {"type": "progress", "data": {"current": N, "total": M, "room_name": "..."}}
          - {"type": "complete", "data": {"video_url": "..."}}
          - {"type": "error", "message": "..."}
        """
        design = self._last_design
        if not design:
            yield {"type": "error", "message": "No design found. Generate a design first."}
            return

        async for event in self.visualizer_agent.create_walkthrough_stream(
            design=design,
            image_urls=image_urls,
        ):
            yield event

    async def generate_design(
        self,
        floor_plan_image: bytes,
        theme: str,
        instructions: str = "",
    ) -> DesignResponse:
        """Non-streaming design generation (used by live session start)."""
        floor_plan_data = await self.floor_plan_agent.analyze(floor_plan_image)

        design = await self.designer_agent.generate(
            floor_plan_data=floor_plan_data,
            theme=theme,
            instructions=instructions,
            floor_plan_image=floor_plan_image,
        )

        self._last_design = design
        self._last_floor_plan = floor_plan_image

        return design

    async def create_walkthrough(
        self,
        image_urls: list[str],
    ) -> VisualizationResponse:
        """Non-streaming walkthrough (fallback)."""
        design = self._last_design
        if not design:
            return VisualizationResponse(rooms=[], video_url=None, status="error")

        return await self.visualizer_agent.create_walkthrough_from_existing(
            design=design,
            image_urls=image_urls,
        )

    async def start_live_session(
        self,
        floor_plan_image: bytes,
        theme: str,
    ) -> LiveSessionStart:
        """Feature 3: Initialize a live interactive design session."""
        session_id = str(uuid.uuid4())

        design = self._last_design
        if not design or design.theme != theme:
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
        reference_image: bytes | None = None,
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
            reference_image=reference_image,
        )

        session["current_design"] = result["updated_design"]
        session["history"].append({
            "user": user_message,
            "changes": result["changes"],
        })

        updated_renders = []
        if result.get("affected_rooms"):
            viz = await self.visualizer_agent.render_rooms_only(
                design=result["updated_design"],
                rooms=result["affected_rooms"],
            )
            updated_renders = viz

        return LiveSessionResponse(
            session_id=session_id,
            agent_message=result["agent_message"],
            updated_renders=updated_renders,
            design_changes=result["changes"],
        )

    def update_design_room_image(self, room_name: str, new_image_url: str) -> bool:
        """Update a room's image in the stored design."""
        if not self._last_design:
            return False
        for room in self._last_design.rooms:
            if room.room_name == room_name:
                room.generated_image_url = new_image_url
                return True
        return False
