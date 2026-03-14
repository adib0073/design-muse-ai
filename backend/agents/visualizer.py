"""Sub-agent responsible for rendering rooms and generating walkthrough videos."""

import os
from collections.abc import AsyncGenerator

from backend.services.imagen import ImagenService
from backend.services.veo import VeoService
from backend.models.schemas import DesignResponse, VisualizationResponse, RoomRender


class VisualizerAgent:
    def __init__(self):
        self.imagen = ImagenService()
        self.veo = VeoService()

    async def create_walkthrough_stream(
        self,
        design: DesignResponse,
        image_urls: list[str],
    ) -> AsyncGenerator[dict, None]:
        """Stream walkthrough generation — yields progress per clip, then the final video URL."""
        room_images: list[tuple[str, bytes]] = []

        for room_design in design.rooms:
            url = room_design.generated_image_url or ""
            if url:
                img_bytes = self._load_local_image(url)
                if img_bytes:
                    room_images.append((room_design.room_name, img_bytes))

        total = len(room_images)
        if total == 0:
            yield {"type": "error", "message": "No room images found to create walkthrough."}
            return

        async for event in self.veo.generate_walkthrough_stream(
            room_images=room_images,
            theme=design.theme,
            style_notes=design.overall_style_notes or "",
        ):
            yield event

    async def create_walkthrough_from_existing(
        self,
        design: DesignResponse,
        image_urls: list[str],
    ) -> VisualizationResponse:
        """Non-streaming walkthrough fallback."""
        rooms = []
        room_images: list[tuple[str, bytes]] = []

        for room_design in design.rooms:
            url = room_design.generated_image_url or ""
            rooms.append(RoomRender(
                room_name=room_design.room_name,
                render_url=url,
                description=room_design.description,
            ))

            if url:
                img_bytes = self._load_local_image(url)
                if img_bytes:
                    room_images.append((room_design.room_name, img_bytes))

        video_url = None
        if room_images:
            video_url = await self.veo.generate_walkthrough(
                room_images=room_images,
                theme=design.theme,
                style_notes=design.overall_style_notes or "",
            )

        if not video_url:
            prompt = self._build_video_prompt(design, rooms)
            video_url = await self.veo.generate_video(prompt)

        return VisualizationResponse(
            rooms=rooms,
            video_url=video_url,
            status="completed",
        )

    async def render_rooms_only(
        self,
        design: DesignResponse,
        rooms: list[str],
        changes: list[str] | None = None,
        reference_image: bytes | None = None,
    ) -> list[RoomRender]:
        """Edit existing room images based on requested changes (live session).

        Strategy per room:
        1. Load existing image and try Gemini image edit (preserves original).
        2. If edit fails, regenerate with Imagen using full description + changes.
        3. If both fail, keep the original image URL.
        """
        target_rooms = {r.strip().lower() for r in rooms}
        rooms_to_render = [
            r for r in design.rooms
            if r.room_name.lower() in target_rooms
        ]

        changes_text = "; ".join(changes) if changes else "Update the design"

        rendered: list[RoomRender] = []
        for room_design in rooms_to_render:
            render_url: str | None = None

            existing_bytes = None
            if room_design.generated_image_url:
                existing_bytes = self._load_local_image(room_design.generated_image_url)

            if existing_bytes:
                print(f"  [1/3] Editing existing image for {room_design.room_name}")
                edit_prompt = self._build_edit_prompt(
                    room_design, design.theme, changes_text, reference_image is not None
                )
                render_url = await self.imagen.edit_room_image(
                    source_image=existing_bytes,
                    edit_prompt=edit_prompt,
                    reference_image=reference_image,
                )
            else:
                print(f"  No existing image for {room_design.room_name}")

            if not render_url:
                print(f"  [2/3] Regenerating {room_design.room_name} with changes baked into prompt")
                fallback_prompt = self._build_render_prompt_with_changes(
                    room_design, design.theme, changes_text
                )
                render_url = await self.imagen.generate_image(fallback_prompt)

            if not render_url and room_design.generated_image_url:
                print(f"  [3/3] Keeping original image for {room_design.room_name}")
                render_url = room_design.generated_image_url

            rendered.append(RoomRender(
                room_name=room_design.room_name,
                render_url=render_url or "",
                description=room_design.description,
            ))

        return rendered

    def _load_local_image(self, url: str) -> bytes | None:
        if url.startswith("/generated/"):
            local_path = url.lstrip("/")
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    return f.read()
        return None

    def _build_edit_prompt(
        self,
        room_design,
        theme: str,
        changes_text: str,
        has_reference: bool,
    ) -> str:
        """Build a prompt for editing an existing room image."""
        base = (
            f"Edit this interior design image of a {room_design.room_name} "
            f"in {theme} style. "
            f"Make the following changes: {changes_text}. "
        )
        if has_reference:
            base += (
                "A reference image of the item to add is also provided. "
                "Extract the item from the reference image and naturally place it "
                "into the room, matching the perspective, lighting, and scale of "
                "the existing design. "
            )
        base += (
            "Keep the rest of the room exactly as it is — same layout, colors, "
            "furniture, and lighting. Only modify what was explicitly requested. "
            "Produce a photorealistic result."
        )
        return base

    def _build_render_prompt_with_changes(
        self, room_design, theme: str, changes_text: str
    ) -> str:
        """Build a generation prompt that incorporates both original design and changes."""
        colors = ", ".join(room_design.color_palette[:4]) if room_design.color_palette else ""
        furniture = ", ".join(room_design.furniture_suggestions[:4]) if room_design.furniture_suggestions else ""
        materials = ", ".join(room_design.materials[:3]) if room_design.materials else ""

        return (
            f"Photorealistic interior design render of a {room_design.room_name} "
            f"in {theme} style. {room_design.description[:400]} "
            f"Color palette: {colors}. "
            f"Furniture: {furniture}. "
            f"Materials: {materials}. "
            f"IMPORTANT modifications applied: {changes_text}. "
            f"Professional architectural visualization, 8K quality, well-lit, realistic."
        )

    def _build_render_prompt(self, room_design, theme: str) -> str:
        colors = ", ".join(room_design.color_palette[:3]) if room_design.color_palette else ""
        furniture = ", ".join(room_design.furniture_suggestions[:3]) if room_design.furniture_suggestions else ""
        materials = ", ".join(room_design.materials[:2]) if room_design.materials else ""

        return (
            f"Photorealistic interior design render of a {room_design.room_name} "
            f"in {theme} style. {room_design.description[:300]} "
            f"Color palette: {colors}. "
            f"Furniture: {furniture}. "
            f"Materials: {materials}. "
            f"Professional architectural visualization, 8K quality, well-lit, realistic."
        )

    def _build_video_prompt(
        self,
        design: DesignResponse,
        rendered_rooms: list[RoomRender],
    ) -> str:
        room_names = [r.room_name for r in rendered_rooms if r.render_url]
        return (
            f"Smooth cinematic walkthrough video of a {design.theme}-themed apartment. "
            f"Walking through spaces: {', '.join(room_names)}. "
            f"Style: {design.overall_style_notes[:200]} "
            f"Professional real estate video, steady camera movement, natural lighting, "
            f"warm atmosphere, photorealistic interior design."
        )
