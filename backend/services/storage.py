"""Google Cloud Storage integration for asset management."""

import os
import uuid

from google.cloud import storage


class StorageService:
    def __init__(self):
        self.bucket_name = os.getenv("GCS_BUCKET_NAME", "designmuse-assets")
        self._client: storage.Client | None = None

    @property
    def client(self) -> storage.Client:
        if self._client is None:
            self._client = storage.Client(
                project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            )
        return self._client

    @property
    def bucket(self) -> storage.Bucket:
        return self.client.bucket(self.bucket_name)

    async def upload_file(
        self,
        file_bytes: bytes,
        destination_folder: str,
        content_type: str = "image/png",
    ) -> str:
        """Upload a file to GCS and return its public URL."""
        filename = f"{uuid.uuid4().hex}"
        ext = content_type.split("/")[-1]
        blob_name = f"{destination_folder}/{filename}.{ext}"

        blob = self.bucket.blob(blob_name)
        blob.upload_from_string(file_bytes, content_type=content_type)
        blob.make_public()

        return blob.public_url

    async def upload_image(self, image_bytes: bytes) -> str:
        return await self.upload_file(
            image_bytes,
            destination_folder="uploads/images",
            content_type="image/png",
        )

    async def upload_video(self, video_bytes: bytes) -> str:
        return await self.upload_file(
            video_bytes,
            destination_folder="generated/videos",
            content_type="video/mp4",
        )

    async def download_file(self, blob_name: str) -> bytes:
        blob = self.bucket.blob(blob_name)
        return blob.download_as_bytes()
