from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import io
from doctr.io import DocumentFile
from doctr.models import ocr_predictor

app = FastAPI(title="docTR OCR")
model = ocr_predictor(pretrained=True)


@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="no file provided")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="empty file")

    try:
        doc = DocumentFile.from_bytes(content)
        result = model(doc)
        lines = []
        for page in result.pages:
            for block in page.blocks:
                for line in block.lines:
                    text = " ".join([w.value for w in line.words]).strip()
                    if text:
                        lines.append(text)
        return JSONResponse({"lines": lines})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
