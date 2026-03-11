"""Sub-agent responsible for analyzing floor plan images."""

import json

from backend.services.gemini import GeminiService


FLOOR_PLAN_ANALYSIS_PROMPT = """You are an expert architectural analyst. Analyze this floor plan image and extract structured information about the space.

Identify and describe:
1. Each room (name, approximate dimensions, shape)
2. Windows and their positions (for natural light analysis)
3. Doors and entry points
4. Fixed elements (columns, built-in features)
5. Room adjacencies and flow between spaces

Return your analysis as JSON with this structure:
{
  "rooms": [
    {
      "name": "Living Room",
      "approximate_dimensions": "4m x 5m",
      "shape": "rectangular",
      "windows": ["south wall, large window"],
      "doors": ["entry from hallway"],
      "fixed_elements": [],
      "notes": "Open plan connected to kitchen"
    }
  ],
  "overall_layout": "Description of the overall apartment layout",
  "total_rooms": 4,
  "style_notes": "Any architectural style observations"
}
"""


class FloorPlanAgent:
    def __init__(self):
        self.gemini = GeminiService()

    async def analyze(self, floor_plan_image: bytes) -> dict:
        """Analyze a floor plan image and return structured room data."""
        response = await self.gemini.analyze_image(
            image_bytes=floor_plan_image,
            prompt=FLOOR_PLAN_ANALYSIS_PROMPT,
        )

        try:
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                cleaned = cleaned.rsplit("```", 1)[0]
            return json.loads(cleaned)
        except (json.JSONDecodeError, IndexError):
            return {
                "rooms": [],
                "overall_layout": response,
                "total_rooms": 0,
                "style_notes": "",
                "raw_analysis": response,
            }
