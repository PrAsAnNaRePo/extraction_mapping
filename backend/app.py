from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image
from surya.recognition import RecognitionPredictor
from surya.detection import DetectionPredictor
from PyPDF2 import PdfReader
from pdf2image import convert_from_bytes
from table_agent import TableDetector
from table_extract import TOCRAgent
import io
import re
import os
from typing import List, Dict, Any
from pydantic import BaseModel
import base64

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],  # Frontend URL
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

# Initialize table detector
table_detector = TableDetector('/media/prasanna/codes/iCoffee/extraction_mapping/extraction_mapping/backend/dynamic_quantized_21.onnx')

# Initialize table extraction agent with system prompt
system_prompt = open("system_prompt.txt", "r").read()

# Initialize table OCR agent
table_ocr_agent = TOCRAgent(system_prompt)

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

        # Convert PDF pages to images
        images = convert_from_bytes(
            contents,
            first_page=min(selected_pages),
            last_page=max(selected_pages),
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
                image = page_images[page_num]
                
                # Detect tables in the image
                try:
                    bbox_result = table_detector.detect_bbox(image)
                    table_data = bbox_result["bbox_data"]
                    table_html = []
                    
                    # Extract tables if any are detected
                    if table_data:
                        # Convert image to base64
                        img_byte_arr = io.BytesIO()
                        image.save(img_byte_arr, format='PNG')
                        img_byte_arr = img_byte_arr.getvalue()
                        base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
                        
                        # Extract table content using Claude
                        table_html, usage = table_ocr_agent.extract_table(
                            base64_image, 
                            file.filename, 
                            page_num
                        )
                        
                        # Debug output to see what's returned
                        print(f"Extracted {len(table_html)} HTML table(s) for page {page_num}")
                        for i, html in enumerate(table_html):
                            print(f"Table {i+1} HTML (first 100 chars): {html[:100]}...")
                except Exception as table_error:
                    print(f"Error detecting tables: {str(table_error)}")
                    table_data = []
                    table_html = []
                
                # Create a version of the image with tables hidden
                table_hidden_image = table_detector.create_table_hidden_image(image)
                
                # Process the table-hidden image with OCR
                predictions = recognition_predictor(
                    [table_hidden_image], 
                    [["en"]], 
                    detection_predictor,
                    recognition_batch_size=16,
                    detection_batch_size=16
                )
                
                # Add page results
                results.append({
                    "page": page_num,
                    "ocr_data": [serialize_ocr_result(pred) for pred in predictions],
                    "tables": {
                        "bbox_data": table_data if "table_data" in locals() else [],
                        "html": table_html
                    }
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
        
        # Convert specific page to image
        images = convert_from_bytes(
            contents,
            first_page=page,
            last_page=page
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

# Endpoint for extracting tables from image
@app.post("/extract-tables")
async def extract_tables_endpoint(
    file: UploadFile = File(...),
    file_name: str = Form("document.pdf"),
    page_num: int = Form(1)
):
    """Extract tables from an image and return HTML representation."""
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Get table detection results
        bbox_result = table_detector.detect_bbox(image)
        
        if not bbox_result["bbox_data"]:
            return {"tables": [], "message": "No tables detected in the image"}
        
        # Convert PIL image to base64 for Claude
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='PNG')
        img_byte_arr = img_byte_arr.getvalue()
        base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
        
        # Extract tables using Claude
        tables, usage = table_ocr_agent.extract_table(base64_image, file_name, page_num)
        
        return {
            "tables": tables,
            "num_tables": len(tables),
            "bbox_data": bbox_result["bbox_data"],
            "usage": {
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting tables: {str(e)}")

# Keep the original OCR endpoint for backward compatibility
@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    """Process a single image file with table extraction."""
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Detect tables in the image
    try:
        bbox_result = table_detector.detect_bbox(image)
        table_data = bbox_result["bbox_data"]
        table_html = []
        
        # Extract tables if any are detected
        if table_data:
            # Convert image to base64
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr = img_byte_arr.getvalue()
            base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
            
            # Extract table content using Claude
            table_html, usage = table_ocr_agent.extract_table(
                base64_image, 
                file.filename, 
                1  # Default page number for single images
            )
            
            # Debug output
            print(f"OCR endpoint: Extracted {len(table_html)} HTML table(s)")
            for i, html in enumerate(table_html):
                print(f"Table {i+1} HTML (first 100 chars): {html[:100]}...")
    except Exception as table_error:
        print(f"Error detecting tables: {str(table_error)}")
        table_data = []
        table_html = []

    # Create a version of the image with tables hidden
    table_hidden_image = table_detector.create_table_hidden_image(image)
    
    # Process with OCR
    predictions = recognition_predictor(
        [table_hidden_image], 
        [["en"]], 
        detection_predictor,
        recognition_batch_size=16,
        detection_batch_size=16
    )
    serialized = [serialize_ocr_result(pred) for pred in predictions]
    
    # Return OCR results along with table information
    return {
        "results": serialized,
        "tables": {
            "bbox_data": table_data if "table_data" in locals() else [],
            "html": table_html
        }
    }