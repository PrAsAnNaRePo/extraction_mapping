from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from surya.recognition import RecognitionPredictor
from surya.detection import DetectionPredictor
import io

app = FastAPI()

# Allow all origins for CORS, credentials, methods, and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware to allow embedding via iframes
@app.middleware("http")
async def add_allow_iframe(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "ALLOWALL"
    return response

# Initialize predictors once
recognition_predictor = RecognitionPredictor()
detection_predictor = DetectionPredictor()

# Helper function to serialize OCR results
def serialize_ocr_result(result):
    return {
        "text_lines": [
            {
                "polygon": line.polygon,
                "confidence": line.confidence,
                "text": line.text,
                "bbox": line.bbox
            } for line in result.text_lines
        ],
        "languages": result.languages,
        "image_bbox": result.image_bbox
    }

@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        # Read image from uploaded file
        image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image file")

    langs = ["en"]
    # Process the image and obtain OCR results
    predictions = recognition_predictor([image], [langs], detection_predictor, recognition_batch_size=2, detection_batch_size=2)
    serialized = [serialize_ocr_result(pred) for pred in predictions]
    return {"results": serialized}