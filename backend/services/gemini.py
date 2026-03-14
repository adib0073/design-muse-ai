"""Gemini API integration for text and multimodal generation."""

import os

from google.genai import types

from backend.services.client import get_client, get_image_client


class GeminiService:
    def __init__(self):
        self.client = get_client()
        self.image_client = get_image_client()
        self.model = "gemini-2.5-flash"
        self.image_models = [
            m.strip()
            for m in os.getenv(
                "IMAGE_EDIT_MODELS",
                "gemini-2.5-flash-image,gemini-3.1-flash-image-preview",
            ).split(",")
            if m.strip()
        ]

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

    def _extract_image_bytes(self, response) -> bytes | None:
        """Extract image bytes from a generate_content response."""
        if not response.candidates or not response.candidates[0].content.parts:
            return None
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                return part.inline_data.data
        return None

    async def edit_image(
        self,
        source_image: bytes,
        edit_prompt: str,
        reference_image: bytes | None = None,
    ) -> bytes | None:
        """Edit an existing image using Gemini's native image generation.

        Sends the source image (and optional reference item image) with an
        editing instruction. Returns the modified image bytes or None.
        """
        contents: list = [
            types.Part.from_bytes(data=source_image, mime_type="image/png"),
        ]
        if reference_image:
            contents.append(
                types.Part.from_bytes(data=reference_image, mime_type="image/png")
            )
        contents.append(edit_prompt)

        for model_name in self.image_models:
            try:
                print(f"  Trying image edit with model: {model_name}")
                response = await self.image_client.aio.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_modalities=["TEXT", "IMAGE"],
                    ),
                )
                image_data = self._extract_image_bytes(response)
                if image_data:
                    print(f"  Image edit succeeded with {model_name}")
                    return image_data
                print(f"  {model_name} returned no image data")
            except Exception as e:
                print(f"  Image edit failed with {model_name}: {e}")

        return None

    async def generate_image_from_prompt(self, prompt: str) -> bytes | None:
        """Generate an image from a text prompt using Gemini image models."""
        for model_name in self.image_models:
            try:
                response = await self.image_client.aio.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_modalities=["TEXT", "IMAGE"],
                    ),
                )
                image_data = self._extract_image_bytes(response)
                if image_data:
                    return image_data
            except Exception as e:
                print(f"Gemini image gen failed with {model_name}: {e}")
        return None

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

        response = await self.image_client.aio.models.generate_content(
            model=self.image_models[0],
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
        )

        return list(response.candidates[0].content.parts) if response.candidates else []
