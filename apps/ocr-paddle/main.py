import os
import tempfile
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from paddleocr import PaddleOCR

app = FastAPI(title="PaddleOCR sidecar")
# English models; angle classifier on
ocr = PaddleOCR(use_angle_cls=True, lang="en")


@app.get("/health")
async def health():
    return {"status": "ok"}


def run_ocr_on_path(path: str):
    """Call PaddleOCR on a file path and flatten text lines."""
    result = ocr.ocr(path, cls=True)
    lines = []
    if result:
        for page in result:
            for line in page:
                text = line[1][0].strip()
                if text:
                    lines.append(text)
    return lines


@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="no file provided")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="empty file")

    # Decide suffix from filename or fall back to .bin
    _, ext = os.path.splitext(file.filename or "")
    suffix = ext if ext else ".bin"

    try:
        # Write to temp so PaddleOCR can handle PDFs as well
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        lines = []

        # If it's an image, try in-memory first (faster)
        if suffix.lower() in [".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"]:
            np_img = np.frombuffer(content, np.uint8)
            img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
            if img is not None:
                result = ocr.ocr(img, cls=True)
                if result:
                    for page in result:
                        for line in page:
                            text = line[1][0].strip()
                            if text:
                                lines.append(text)

        # If no lines yet, fall back to letting PaddleOCR handle the file path (works for PDF/images)
        if not lines:
            lines = run_ocr_on_path(tmp_path)

        os.unlink(tmp_path)

        if not lines:
            raise HTTPException(status_code=422, detail="no text detected")

        return JSONResponse({"lines": lines})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
