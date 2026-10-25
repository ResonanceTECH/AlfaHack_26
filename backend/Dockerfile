FROM python:3.12.8-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Prefer full lock (transitive pins); fall back to requirements.txt
COPY backend/requirements.lock backend/requirements.txt ./
RUN pip install --no-cache-dir --timeout 120 --retries 5 -r requirements.lock

COPY scoring /opt/scoring
RUN pip install --no-cache-dir /opt/scoring

COPY backend .

RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
