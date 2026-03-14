"""Image generation service with Imagen 3 primary and Gemini native fallback."""

import os
import uuid

from google.genai import types

from backend.services.client import get_client
from backend.services.gemini import GeminiService


class ImagenService:
    def __init__(self):
        self.client = get_client()
        self.imagen_model = "imagen-3.0-fast-generate-001"
        self.output_dir = "generated/images"
        self._gemini = GeminiService()
        os.makedirs(self.output_dir, exist_ok=True)

    async def generate_image(self, prompt: str) -> str | None:
        """Generate an image, trying Imagen 3 first then falling back to Gemini."""
        url = await self._try_imagen(prompt)
        if url:
            return url

        return await self._try_gemini_native(prompt)

    async def edit_room_image(
        self,
        source_image: bytes,
        edit_prompt: str,
        reference_image: bytes | None = None,
    ) -> str | None:
        """Edit an existing room image using Gemini's native image editing.
        Returns the new image URL, or None if editing failed.
        """
        edited = await self._gemini.edit_image(
            source_image=source_image,
            edit_prompt=edit_prompt,
            reference_image=reference_image,
        )
        if edited:
            return self._save_image(edited)

        print("Image edit failed; caller should handle fallback")
        return None

    async def _try_imagen(self, prompt: str) -> str | None:
        try:
            response = await self.client.aio.models.generate_images(
                model=self.imagen_model,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="16:9",
                    safety_filter_level="BLOCK_ONLY_HIGH",
                ),
            )

            if response.generated_images:
                image = response.generated_images[0]
                return self._save_image(image.image.image_bytes)

        except Exception as e:
            print(f"Imagen 3 failed (falling back to Gemini): {e}")

        return None

    async def _try_gemini_native(self, prompt: str) -> str | None:
        """Use Gemini image models as fallback for text-to-image."""
        try:
            image_bytes = await self._gemini.generate_image_from_prompt(
                f"Generate a single high-quality interior design image: {prompt}"
            )
            if image_bytes:
                return self._save_image(image_bytes)
        except Exception as e:
            print(f"Gemini native image generation also failed: {e}")

        return None

    def _save_image(self, image_bytes: bytes) -> str:
        filename = f"{uuid.uuid4().hex}.png"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "wb") as f:
            f.write(image_bytes)
        return f"/generated/images/{filename}"
