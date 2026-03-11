"""Veo 3.1 Fast integration for video generation."""

import asyncio
import os
import uuid

from google.genai import types

from backend.services.client import get_client


class VeoService:
    def __init__(self):
        self.client = get_client()
        self.model = "veo-3.1-fast-generate-001"
        self.output_dir = "generated/videos"
        os.makedirs(self.output_dir, exist_ok=True)

    async def generate_video(self, prompt: str) -> str | None:
        """Generate a video from a text prompt using Veo 3.1 Fast.

        Returns the URL path of the generated video, or None on failure.
        """
        try:
            operation = await self.client.aio.models.generate_videos(
                model=self.model,
                prompt=prompt,
                config=types.GenerateVideosConfig(
                    aspect_ratio="16:9",
                    number_of_videos=1,
                ),
            )

            while not operation.done:
                await asyncio.sleep(5)
                operation = await self.client.aio.operations.get(operation)

            if operation.result and operation.result.generated_videos:
                video = operation.result.generated_videos[0]
                filename = f"{uuid.uuid4().hex}.mp4"
                filepath = os.path.join(self.output_dir, filename)

                with open(filepath, "wb") as f:
                    f.write(video.video.video_bytes)

                return f"/generated/videos/{filename}"

        except Exception as e:
            print(f"Veo video generation failed: {e}")

        return None
