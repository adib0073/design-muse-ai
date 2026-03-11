"""Sub-agent responsible for rendering rooms and generating walkthrough videos."""

from backend.services.imagen import ImagenService
from backend.services.veo import VeoService
from backend.models.schemas import DesignResponse, VisualizationResponse, RoomRender


class VisualizerAgent:
    def __init__(self):
        self.imagen = ImagenService()
        self.veo = VeoService()

    async def render(
        self,
        design: DesignResponse,
        room: str = "all",
        reference_images: list[bytes] | None = None,
    ) -> VisualizationResponse:
        """Render room images and generate a walkthrough video."""
        rooms_to_render = design.rooms
        if room != "all":
            target_rooms = {r.strip().lower() for r in room.split(",")}
            rooms_to_render = [
                r for r in design.rooms
                if r.room_name.lower() in target_rooms
            ]

        rendered_rooms: list[RoomRender] = []
        for room_design in rooms_to_render:
            prompt = self._build_render_prompt(room_design, design.theme, reference_images)
            render_url = await self.imagen.generate_image(prompt)
            rendered_rooms.append(RoomRender(
                room_name=room_design.room_name,
                render_url=render_url or "",
                description=room_design.description,
            ))

        video_url = None
        if len(rendered_rooms) >= 1:
            video_prompt = self._build_video_prompt(design, rendered_rooms)
            video_url = await self.veo.generate_video(video_prompt)

        return VisualizationResponse(
            rooms=rendered_rooms,
            video_url=video_url,
            status="completed",
        )

    def _build_render_prompt(
        self,
        room_design,
        theme: str,
        reference_images: list[bytes] | None = None,
    ) -> str:
        colors = ", ".join(room_design.color_palette[:3]) if room_design.color_palette else ""
        furniture = ", ".join(room_design.furniture_suggestions[:3]) if room_design.furniture_suggestions else ""
        materials = ", ".join(room_design.materials[:2]) if room_design.materials else ""

        ref_note = ""
        if reference_images:
            ref_note = " Incorporate the style and elements from the provided reference images."

        return (
            f"Photorealistic interior design render of a {room_design.room_name} "
            f"in {theme} style. {room_design.description[:300]} "
            f"Color palette: {colors}. "
            f"Furniture: {furniture}. "
            f"Materials: {materials}. "
            f"{ref_note}"
            f"Professional architectural visualization, 8K quality, well-lit, realistic."
        )

    def _build_video_prompt(
        self,
        design: DesignResponse,
        rendered_rooms: list[RoomRender],
    ) -> str:
        room_names = [r.room_name for r in rendered_rooms]
        return (
            f"Smooth cinematic walkthrough video of a {design.theme}-themed apartment. "
            f"Walking through rooms: {', '.join(room_names)}. "
            f"Style: {design.overall_style_notes[:200]} "
            f"Professional real estate video, steady camera movement, natural lighting, "
            f"warm atmosphere, photorealistic interior design."
        )
