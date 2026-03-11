"""Gemini API integration for text and multimodal generation."""

from google.genai import types

from backend.services.client import get_client


class GeminiService:
    def __init__(self):
        self.client = get_client()
        self.model = "gemini-2.0-flash"

    async def generate_text(self, prompt: str) -> str:
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=prompt,
        )
        return response.text or ""

    async def generate_json(
        self,
        prompt: str,
        image_bytes: bytes | None = None,
        extra_images: list[bytes] | None = None,
    ) -> str:
        """Generate a response constrained to valid JSON output."""
        contents: list = []
        if image_bytes:
            contents.append(types.Part.from_bytes(data=image_bytes, mime_type="image/png"))
        if extra_images:
            for img in extra_images:
                contents.append(types.Part.from_bytes(data=img, mime_type="image/png"))
        contents.append(prompt)

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        return response.text or ""

    async def analyze_image(self, image_bytes: bytes, prompt: str) -> str:
        """Send an image + text prompt to Gemini for multimodal analysis."""
        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=[image_part, prompt],
        )
        return response.text or ""

    async def generate_interleaved(
        self,
        prompt: str,
        image_bytes: bytes | None = None,
    ) -> list[types.Part]:
        """Generate interleaved text + image output (Creative Storyteller)."""
        contents = []
        if image_bytes:
            contents.append(types.Part.from_bytes(data=image_bytes, mime_type="image/png"))
        contents.append(prompt)

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
        )

        return list(response.candidates[0].content.parts) if response.candidates else []
