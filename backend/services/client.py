"""Shared Google GenAI client factory.

Supports two backends:
  - Vertex AI (Google Cloud): set USE_VERTEX_AI=true
  - AI Studio (API key):      set GEMINI_API_KEY
"""

import os

from google import genai

_client: genai.Client | None = None
_image_client: genai.Client | None = None


def get_client() -> genai.Client:
    """Client for text, Imagen, and Veo models (region-specific)."""
    global _client
    if _client is not None:
        return _client

    use_vertex = os.getenv("USE_VERTEX_AI", "false").lower() in ("true", "1", "yes")

    if use_vertex:
        _client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
        )
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Set GEMINI_API_KEY or enable USE_VERTEX_AI=true")
        _client = genai.Client(api_key=api_key)

    return _client


def get_image_client() -> genai.Client:
    """Client for Gemini image generation/editing models.

    These models (gemini-*-image*) require location='global' on Vertex AI.
    """
    global _image_client
    if _image_client is not None:
        return _image_client

    use_vertex = os.getenv("USE_VERTEX_AI", "false").lower() in ("true", "1", "yes")

    if use_vertex:
        _image_client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location="global",
        )
    else:
        _image_client = get_client()

    return _image_client
