"""Sub-agent responsible for generating themed interior designs."""

import json
import re

from backend.services.gemini import GeminiService
from backend.services.imagen import ImagenService
from backend.models.schemas import DesignResponse, RoomDesign


DESIGN_GENERATION_PROMPT = """You are a world-class interior designer. Based on the floor plan analysis and the requested theme, create a complete interior design plan.

Floor Plan Analysis:
{floor_plan_data}

Requested Theme: {theme}
{instructions}

For EACH room in the floor plan, provide:
1. A vivid description of how the room should look in this theme
2. A color palette as a flat JSON array of hex code strings, e.g. ["#F8F4E3", "#99C1DE", "#E9D66B"]
3. Specific furniture recommendations (with style, material, placement)
4. Decoration and accessory suggestions
5. Material recommendations (flooring, wall treatments, fabrics, lighting)

IMPORTANT: Return ONLY valid JSON. The "color_palette" field MUST be a plain array of hex strings.
Do NOT use objects or key-value pairs inside the color_palette array.

Example of CORRECT color_palette: ["#F8F4E3", "#99C1DE", "#E9D66B"]
Example of WRONG color_palette: ["#F8F4E3": "Cream"] — this is invalid JSON.

Return this exact JSON structure:
{{
  "theme": "{theme}",
  "floor_plan_analysis": "Brief summary of the space",
  "overall_style_notes": "Cohesive design philosophy connecting all rooms",
  "rooms": [
    {{
      "room_name": "Living Room",
      "description": "Vivid description of the designed room",
      "color_palette": ["#F8F4E3", "#99C1DE"],
      "furniture_suggestions": ["Specific furniture with style details"],
      "decoration_suggestions": ["Specific decorations"],
      "materials": ["Flooring, wall, fabric specifications"]
    }}
  ]
}}

Be specific, creative, and ensure design coherence across all rooms.
"""


MODIFY_DESIGN_PROMPT = """You are a world-class interior designer in a live consultation session.

Current design state:
{current_design}

The client has requested the following change:
"{user_request}"
{reference_note}

Analyze the request and:
1. Determine which rooms are affected
2. Describe what changes to make
3. Provide the updated design for affected rooms
4. Explain any design implications

IMPORTANT: "color_palette" must be a plain array of hex strings like ["#F8F4E3", "#99C1DE"].

Return ONLY valid JSON:
{{
  "agent_message": "Your conversational response to the client",
  "changes": ["List of specific changes made"],
  "affected_rooms": ["room names"],
  "updated_rooms": [
    {{
      "room_name": "...",
      "description": "Updated description",
      "color_palette": ["#HEX1", "#HEX2"],
      "furniture_suggestions": ["..."],
      "decoration_suggestions": ["..."],
      "materials": ["..."]
    }}
  ]
}}
"""


class DesignerAgent:
    def __init__(self):
        self.gemini = GeminiService()
        self.imagen = ImagenService()

    async def generate_text(
        self,
        floor_plan_data: dict,
        theme: str,
        instructions: str = "",
        floor_plan_image: bytes | None = None,
    ) -> DesignResponse:
        """Generate design text only (no images). Returns DesignResponse with rooms but no generated_image_url."""
        instruction_text = f"\nAdditional instructions: {instructions}" if instructions else ""

        prompt = DESIGN_GENERATION_PROMPT.format(
            floor_plan_data=json.dumps(floor_plan_data, indent=2),
            theme=theme,
            instructions=instruction_text,
        )

        response = await self.gemini.generate_json(
            prompt=prompt,
            image_bytes=floor_plan_image,
        )

        return self._parse_response(response, theme)

    async def generate_room_image(self, room: RoomDesign, theme: str) -> str | None:
        """Generate an image for a single room. Returns the image URL or None."""
        image_prompt = self._build_room_image_prompt(room, theme)
        return await self.imagen.generate_image(image_prompt)

    async def generate(
        self,
        floor_plan_data: dict,
        theme: str,
        instructions: str = "",
        floor_plan_image: bytes | None = None,
    ) -> DesignResponse:
        """Generate a complete themed design for all rooms (text + all images)."""
        design_data = await self.generate_text(
            floor_plan_data=floor_plan_data,
            theme=theme,
            instructions=instructions,
            floor_plan_image=floor_plan_image,
        )

        for room in design_data.rooms:
            image_url = await self.generate_room_image(room, theme)
            room.generated_image_url = image_url

        return design_data

    async def modify_design(
        self,
        current_design: DesignResponse,
        user_request: str,
        floor_plan_image: bytes | None = None,
        reference_image: bytes | None = None,
    ) -> dict:
        """Modify an existing design based on user request (live session)."""
        reference_note = ""
        if reference_image:
            reference_note = (
                "\nThe client has also attached a reference image showing the item, "
                "furniture, style, or material they want to incorporate. "
                "Analyze this image and integrate what you see into the design changes."
            )

        prompt = MODIFY_DESIGN_PROMPT.format(
            current_design=current_design.model_dump_json(indent=2),
            user_request=user_request,
            reference_note=reference_note,
        )

        extra_images = [reference_image] if reference_image else None
        response = await self.gemini.generate_json(
            prompt=prompt,
            image_bytes=floor_plan_image,
            extra_images=extra_images,
        )

        result = self._safe_parse_json(response)
        if not result:
            result = {
                "agent_message": response,
                "changes": [],
                "affected_rooms": [],
                "updated_rooms": [],
            }

        updated_design = current_design.model_copy()
        if result.get("updated_rooms"):
            updated_room_map = {r["room_name"]: r for r in result["updated_rooms"]}
            new_rooms = []
            for room in updated_design.rooms:
                if room.room_name in updated_room_map:
                    update = updated_room_map[room.room_name]
                    update = self._fix_room_data(update)
                    # Preserve the existing generated image URL — Gemini's
                    # response won't include it because it only returns text.
                    update.setdefault("generated_image_url", room.generated_image_url)
                    new_rooms.append(RoomDesign(**update))
                else:
                    new_rooms.append(room)
            updated_design.rooms = new_rooms

        return {
            "agent_message": result.get("agent_message", "Design updated."),
            "changes": result.get("changes", []),
            "affected_rooms": result.get("affected_rooms", []),
            "updated_design": updated_design,
        }

    def _parse_response(self, response: str, theme: str) -> DesignResponse:
        data = self._safe_parse_json(response)
        if not data:
            return DesignResponse(
                theme=theme,
                floor_plan_analysis=response[:500],
                rooms=[],
                overall_style_notes=response,
            )

        if "rooms" in data:
            data["rooms"] = [self._fix_room_data(r) for r in data["rooms"]]

        try:
            return DesignResponse(**data)
        except (ValueError, TypeError) as e:
            print(f"Pydantic validation failed: {e}")
            return DesignResponse(
                theme=theme,
                floor_plan_analysis=data.get("floor_plan_analysis", response[:500]),
                rooms=[],
                overall_style_notes=data.get("overall_style_notes", ""),
            )

    def _safe_parse_json(self, text: str) -> dict | None:
        """Parse JSON with fallback cleaning for common Gemini quirks."""
        cleaned = text.strip()

        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        fixed = re.sub(
            r'"(#[0-9A-Fa-f]{6})"\s*:\s*"([^"]*)"',
            r'"\1"',
            cleaned,
        )
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass

        print(f"JSON parse failed. First 200 chars: {cleaned[:200]}")
        return None

    def _fix_room_data(self, room: dict) -> dict:
        """Normalize a room dict to match the RoomDesign schema."""
        palette = room.get("color_palette", [])
        if isinstance(palette, dict):
            room["color_palette"] = list(palette.keys())
        elif isinstance(palette, list):
            fixed = []
            for item in palette:
                if isinstance(item, dict):
                    fixed.extend(item.keys())
                elif isinstance(item, str):
                    hex_match = re.match(r"(#[0-9A-Fa-f]{6})", item)
                    fixed.append(hex_match.group(1) if hex_match else item)
                else:
                    fixed.append(str(item))
            room["color_palette"] = fixed
        return room

    def _build_room_image_prompt(self, room: RoomDesign, theme: str) -> str:
        colors = ", ".join(room.color_palette[:3]) if room.color_palette else ""
        furniture = ", ".join(room.furniture_suggestions[:3]) if room.furniture_suggestions else ""
        return (
            f"Interior design photo of a {room.room_name} in {theme} style. "
            f"{room.description[:200]} "
            f"Color palette: {colors}. "
            f"Featuring: {furniture}. "
            f"Professional architectural photography, high quality, realistic, well-lit."
        )
