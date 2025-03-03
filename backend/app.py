from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Response, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse
from PIL import Image
from surya.recognition import RecognitionPredictor
from surya.detection import DetectionPredictor
from PyPDF2 import PdfReader
from pdf2image import convert_from_bytes
import io
import re
from typing import List, Dict, Any
from pydantic import BaseModel
import base64

class TextEdit(BaseModel):
    page: int
    text_lines: List[Dict[str, Any]]

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:51560", "http://localhost:59343", "http://localhost:3000", "*"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
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

def parse_page_selection(page_selection: str, total_pages: int) -> List[int]:
    """Parse page selection string and return list of page numbers."""
    if not page_selection or page_selection.isspace():
        raise ValueError("Page selection cannot be empty")
    
    if page_selection.lower() == "all":
        return list(range(1, total_pages + 1))
    
    pages = set()
    # Split by comma and process each part
    parts = page_selection.replace(" ", "").split(",")
    
    for part in parts:
        if "-" in part:
            # Handle range (e.g., "1-3")
            try:
                start, end = map(int, part.split("-"))
                if start < 1 or end > total_pages or start > end:
                    raise ValueError(f"Invalid range {part}")
                pages.update(range(start, end + 1))
            except ValueError as e:
                raise ValueError(f"Invalid range format in {part}")
        else:
            # Handle single page
            try:
                page = int(part)
                if page < 1 or page > total_pages:
                    raise ValueError(f"Page {page} out of range")
                pages.add(page)
            except ValueError:
                raise ValueError(f"Invalid page number: {part}")
    
    return sorted(list(pages))

def serialize_ocr_result(result):
    """Helper function to serialize OCR results."""
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

@app.post("/pdf-info")
async def get_pdf_info(file: UploadFile = File(...)):
    """Get basic information about the PDF file."""
    try:
        contents = await file.read()
        pdf = PdfReader(io.BytesIO(contents))
        return {
            "total_pages": len(pdf.pages),
            "file_name": file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF file: {str(e)}")

@app.post("/process-pdf")
async def process_pdf(
    file: UploadFile = File(...),
    page_selection: str = Form(...)
):
    """Process selected pages from a PDF file."""
    try:
        # Verify file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")

        # Read PDF file
        contents = await file.read()
        
        # Debug: Print file size and first few bytes
        print(f"Received file size: {len(contents)} bytes")
        print(f"First 20 bytes: {contents[:20]}")
        
        # Create a new BytesIO object and write the contents
        pdf_stream = io.BytesIO(contents)
        pdf_stream.seek(0)  # Reset stream position
        
        try:
            pdf = PdfReader(pdf_stream)
            total_pages = len(pdf.pages)
        except Exception as pdf_error:
            print(f"PDF Error details: {str(pdf_error)}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid PDF file: {str(pdf_error)}"
            )

        # Parse and validate page selection
        try:
            selected_pages = parse_page_selection(page_selection, total_pages)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Convert PDF pages to images with additional options for better compatibility
        try:
            images = convert_from_bytes(
                contents,
                first_page=min(selected_pages),
                last_page=max(selected_pages),
                dpi=225,  # Higher DPI for better quality
                fmt='png',  # Use PNG format for better quality
                thread_count=2,  # Use multiple threads for faster processing
                use_cropbox=True,  # Use cropbox instead of mediabox
                strict=False  # Less strict parsing for better compatibility
            )
            for img in images:
                print(img.size)
        except Exception as convert_error:
            print(f"PDF Conversion Error: {str(convert_error)}")
            raise HTTPException(
                status_code=400,
                detail=f"Error converting PDF to images: {str(convert_error)}"
            )

        # Map converted images to selected pages
        page_images = dict(zip(
            range(min(selected_pages), max(selected_pages) + 1),
            images
        ))

        # Process selected pages
        results = []
        for page_num in selected_pages:
            if page_num in page_images:
                # Process the image with OCR
                predictions = recognition_predictor(
                    [page_images[page_num]], 
                    [["en"]], 
                    detection_predictor,
                    recognition_batch_size=16,
                    detection_batch_size=16
                )
                
                # Add page results
                results.append({
                    "page": page_num,
                    "ocr_data": [serialize_ocr_result(pred) for pred in predictions]
                })

        return {
            "total_pages": total_pages,
            "processed_pages": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# Endpoint to get a specific page as image with base64 encoding
@app.post("/get-page-image")
async def get_page_image(
    file: UploadFile = File(...),
    page: int = Form(...),
):
    """Convert a specific PDF page to an image and return it as base64."""
    try:
        contents = await file.read()
        
        # Convert specific page to image with improved options
        try:
            images = convert_from_bytes(
                contents,
                first_page=page,
                last_page=page,
                dpi=200,  # Higher DPI for better quality
                fmt='png',  # Use PNG format for better quality
                thread_count=2,  # Use multiple threads for faster processing
                use_cropbox=True,  # Use cropbox instead of mediabox
                strict=False  # Less strict parsing for better compatibility
            )
        except Exception as convert_error:
            print(f"PDF Conversion Error: {str(convert_error)}")
            raise HTTPException(
                status_code=400,
                detail=f"Error converting PDF to image: {str(convert_error)}"
            )
        
        if not images:
            raise HTTPException(status_code=404, detail="Page not found")
            
        # Convert PIL image to base64
        img_byte_arr = io.BytesIO()
        images[0].save(img_byte_arr, format='PNG')
        img_byte_arr = img_byte_arr.getvalue()
        
        # Convert to base64
        base64_encoded = base64.b64encode(img_byte_arr).decode('utf-8')
        
        return {
            "image": f"data:image/png;base64,{base64_encoded}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing page: {str(e)}")

# Keep the original OCR endpoint for backward compatibility
@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    """Process a single image file."""
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image file")

    predictions = recognition_predictor(
        [image], 
        [["en"]], 
        detection_predictor,
        recognition_batch_size=16,
        detection_batch_size=16
    )
    serialized = [serialize_ocr_result(pred) for pred in predictions]
    return {"results": serialized}
    
# Add an endpoint to save edited text
@app.post("/save-edited-text")
async def save_edited_text(text_edit: TextEdit):
    """Save edited text for a specific page."""
    try:
        # In a real app, you would save this to a database
        # For now, we'll just return success and the saved data
        print(f"Saving edited text for page {text_edit.page}")
        print(f"Text lines: {len(text_edit.text_lines)}")
        
        # Return the saved data
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Text edits saved successfully",
                "data": {
                    "page": text_edit.page,
                    "text_count": len(text_edit.text_lines)
                }
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error saving edited text: {str(e)}"
        )