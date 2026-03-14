"""Veo 3.1 Fast integration for video generation with clip stitching."""

import asyncio
import os
import subprocess
import uuid
from collections.abc import AsyncGenerator

from google.genai import types

from backend.services.client import get_client
from backend.services.storage import StorageService

IS_CLOUD_RUN = bool(os.getenv("K_SERVICE"))


class VeoService:
    def __init__(self):
        self.client = get_client()
        self.model = "veo-3.1-fast-generate-001"
        self.output_dir = "generated/videos"
        self.clips_dir = "generated/videos/clips"
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.clips_dir, exist_ok=True)
        self._storage = StorageService() if IS_CLOUD_RUN else None

    MAX_CONCURRENT_CLIPS = 4

    async def generate_walkthrough_stream(
        self,
        room_images: list[tuple[str, bytes]],
        theme: str,
        style_notes: str = "",
    ) -> AsyncGenerator[dict, None]:
        """Generate walkthrough with parallel clip generation.

        Yields:
          {"type": "progress", "data": {"current": N, "total": M, "room_name": "..."}}
          {"type": "stitching"}
          {"type": "complete", "data": {"video_url": "..."}}
          {"type": "error", "message": "..."}
        """
        total = len(room_images)
        semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_CLIPS)
        completed = 0
        results: dict[int, str | None] = {}
        progress_queue: asyncio.Queue[dict] = asyncio.Queue()

        async def _gen_clip(idx: int, room_name: str, image_bytes: bytes):
            prompt = (
                f"Slow cinematic camera pan through a {theme}-themed {room_name}. "
                f"Smooth steady movement revealing interior details. "
                f"Professional real estate video, natural lighting, warm atmosphere."
            )
            async with semaphore:
                clip_path = await self._generate_clip_from_image(image_bytes, prompt)
            if clip_path:
                print(f"  Clip {idx + 1}/{total} done: {room_name}")
            else:
                print(f"  Clip {idx + 1}/{total} failed: {room_name}, skipping")
            results[idx] = clip_path
            await progress_queue.put({
                "type": "progress",
                "data": {"current": len(results), "total": total, "room_name": room_name},
            })

        tasks = [
            asyncio.create_task(_gen_clip(i, name, img))
            for i, (name, img) in enumerate(room_images)
        ]

        while completed < total:
            event = await progress_queue.get()
            completed += 1
            yield event

        await asyncio.gather(*tasks, return_exceptions=True)

        clip_paths = [results[i] for i in range(total) if results.get(i)]

        if not clip_paths:
            yield {"type": "error", "message": "All clip generations failed."}
            return

        yield {"type": "stitching"}

        if len(clip_paths) == 1:
            final_name = f"{uuid.uuid4().hex}.mp4"
            final_path = os.path.join(self.output_dir, final_name)
            os.rename(clip_paths[0], final_path)
        else:
            final_path = self._stitch_clips_to_file(clip_paths)

        if final_path:
            video_url = await self._publish_video(final_path)
            yield {"type": "complete", "data": {"video_url": video_url}}
        else:
            yield {"type": "error", "message": "Video stitching failed."}

    async def generate_walkthrough(
        self,
        room_images: list[tuple[str, bytes]],
        theme: str,
        style_notes: str = "",
    ) -> str | None:
        """Non-streaming walkthrough (consumes the stream internally)."""
        video_url = None
        async for event in self.generate_walkthrough_stream(room_images, theme, style_notes):
            if event["type"] == "complete":
                video_url = event["data"]["video_url"]
        return video_url

    async def generate_video(self, prompt: str) -> str | None:
        """Generate a single video from a text prompt."""
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
                local_path = self._save_video(video.video.video_bytes)
                return await self._publish_video(local_path.lstrip("/"))

        except Exception as e:
            print(f"Veo text-to-video failed: {e}")

        return None

    async def _generate_clip_from_image(
        self,
        image_bytes: bytes,
        prompt: str,
    ) -> str | None:
        try:
            image = types.Image(image_bytes=image_bytes, mime_type="image/png")

            operation = await self.client.aio.models.generate_videos(
                model=self.model,
                prompt=prompt,
                image=image,
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
                clip_name = f"clip_{uuid.uuid4().hex}.mp4"
                clip_path = os.path.join(self.clips_dir, clip_name)
                with open(clip_path, "wb") as f:
                    f.write(video.video.video_bytes)
                return clip_path

        except Exception as e:
            print(f"Veo image-to-video clip failed: {e}")

        return None

    def _stitch_clips_to_file(self, clip_paths: list[str]) -> str | None:
        concat_list = os.path.join(self.clips_dir, f"concat_{uuid.uuid4().hex}.txt")
        final_name = f"{uuid.uuid4().hex}.mp4"
        final_path = os.path.join(self.output_dir, final_name)

        try:
            with open(concat_list, "w") as f:
                for path in clip_paths:
                    abs_path = os.path.abspath(path)
                    f.write(f"file '{abs_path}'\n")

            result = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-f", "concat",
                    "-safe", "0",
                    "-i", concat_list,
                    "-c", "copy",
                    final_path,
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )

            if result.returncode != 0:
                print(f"ffmpeg concat failed: {result.stderr}")
                return None

            return final_path

        except Exception as e:
            print(f"Video stitching failed: {e}")
            return None

        finally:
            for path in clip_paths:
                try:
                    os.remove(path)
                except OSError:
                    pass
            try:
                os.remove(concat_list)
            except OSError:
                pass

    async def _publish_video(self, local_path: str) -> str:
        """Upload to GCS on Cloud Run, or return a local URL for dev."""
        if self._storage:
            with open(local_path, "rb") as f:
                video_bytes = f.read()
            try:
                url = await self._storage.upload_video(video_bytes)
                os.remove(local_path)
                return url
            except Exception as e:
                print(f"GCS upload failed, falling back to local: {e}")

        filename = os.path.basename(local_path)
        return f"/generated/videos/{filename}"

    def _save_video(self, video_bytes: bytes) -> str:
        filename = f"{uuid.uuid4().hex}.mp4"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "wb") as f:
            f.write(video_bytes)
        return f"/generated/videos/{filename}"
