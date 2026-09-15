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
    """Call PaddleOCR on a file path, keeping each page's lines separate - PaddleOCR already
    returns one result entry per page for a multi-page PDF, so this only has to avoid flattening
    that away (which the old version of this function did)."""
    result = ocr.ocr(path, cls=True)
    pages = []
    if result:
        for page in result:
            lines = [line[1][0].strip() for line in page if line[1][0].strip()]
            pages.append(lines)
    return pages


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

        pages = []

        # If it's an image, try in-memory first (faster) - always exactly one "page".
        if suffix.lower() in [".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"]:
            np_img = np.frombuffer(content, np.uint8)
            img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
            if img is not None:
                result = ocr.ocr(img, cls=True)
                if result:
                    lines = [line[1][0].strip() for page in result for line in page if line[1][0].strip()]
                    if lines:
                        pages = [lines]

        # If no pages yet, fall back to letting PaddleOCR handle the file path (works for PDF/images) -
        # this is the path that actually distinguishes pages for a multi-page PDF.
        if not pages:
            pages = run_ocr_on_path(tmp_path)

        os.unlink(tmp_path)

        pages = [p for p in pages if p]
        if not pages:
            raise HTTPException(status_code=422, detail="no text detected")

        # "lines" (flattened) kept alongside "pages" (grouped) so nothing else calling this
        # sidecar directly - manual testing, a future caller - breaks on the response shape.
        return JSONResponse({"pages": pages, "lines": [line for page in pages for line in page]})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
