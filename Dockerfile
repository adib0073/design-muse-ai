FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

RUN mkdir -p generated/images generated/videos uploads

ENV PORT=8000
EXPOSE ${PORT}

CMD sh -c "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"
