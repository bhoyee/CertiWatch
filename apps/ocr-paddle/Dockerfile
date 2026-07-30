FROM python:3.10-slim

WORKDIR /app

# Needed for opencv headless and healthcheck curl
RUN apt-get -o Acquire::Retries=5 update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 build-essential swig curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Prefer binary wheels to avoid compiling heavy deps like MuPDF
ENV PIP_PREFER_BINARY=1
# Preinstall wheels and force a compatible numpy (opencv/paddle need <=1.26)
RUN pip install --no-cache-dir --prefer-binary numpy==1.26.4 PyMuPDF==1.20.2 && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir numpy==1.26.4

COPY main.py .

ENV UVICORN_HOST=0.0.0.0
ENV UVICORN_PORT=8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
