# Table Extraction Integration

This document provides instructions for testing the new table extraction functionality that has been integrated into the backend.

## Overview

The backend now supports three main ways to extract tables:

1. `/extract-tables` endpoint: A dedicated endpoint for table extraction
2. `/ocr` endpoint: Now includes table extraction along with text extraction
3. `/process-pdf` endpoint: PDF processing now includes table extraction

## Prerequisites

1. Make sure you have the Claude API key set in your environment variables:
   ```bash
   export ANTHROPIC_API_KEY="your_api_key_here"
   ```
   
   Or create a `.env` file in the backend directory with:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

2. Install required Python packages:
   ```bash
   pip install anthropic dotenv-python
   ```

3. Prepare test files:
   - A PDF with tables
   - An image (PNG, JPG) with tables

## Running the Backend

Start the FastAPI backend:

```bash
cd backend
uvicorn app:app --host 0.0.0.0 --port 3002 --reload
```

## Running the Tests

1. Update the test paths in `test_table_extraction.py`:
   - `TEST_IMAGE_PATH`: Path to an image containing tables
   - `TEST_PDF_PATH`: Path to a PDF containing tables

2. Run the test script:
   ```bash
   python test_table_extraction.py
   ```

## API Documentation

### 1. Extract Tables Endpoint

**URL**: `/extract-tables`  
**Method**: POST  
**Form Data**:
- `file`: The image file to analyze
- `file_name`: (Optional) Original file name
- `page_num`: (Optional) Page number, default is 1

**Response**:
```json
{
  "tables": ["<table>...</table>", "..."],
  "num_tables": 2,
  "bbox_data": [
    {
      "class_id": 0,
      "xyxy": [x1, y1, x2, y2],
      "xywh": [x, y, w, h]
    }
  ],
  "usage": {
    "input_tokens": 1200,
    "output_tokens": 450
  }
}
```

### 2. OCR Endpoint with Tables

**URL**: `/ocr`  
**Method**: POST  
**Form Data**:
- `file`: The image file to analyze

**Response**:
```json
{
  "results": [
    {
      "text_lines": [
        {
          "text": "Example text",
          "confidence": 0.95,
          "bbox": [x1, y1, x2, y2],
          "polygon": [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
        }
      ],
      "languages": ["en"],
      "image_bbox": [0, 0, width, height]
    }
  ],
  "tables": {
    "bbox_data": [
      {
        "class_id": 0,
        "xyxy": [x1, y1, x2, y2],
        "xywh": [x, y, w, h]
      }
    ],
    "html": ["<table>...</table>", "..."]
  }
}
```

### 3. Process PDF Endpoint with Tables

**URL**: `/process-pdf`  
**Method**: POST  
**Form Data**:
- `file`: The PDF file to analyze
- `page_selection`: Page numbers to process (e.g., "1-3", "1,3,5", "all")

**Response**:
```json
{
  "total_pages": 5,
  "processed_pages": [
    {
      "page": 1,
      "ocr_data": [{
        "text_lines": [{
          "text": "Example text",
          "confidence": 0.95,
          "bbox": [x1, y1, x2, y2],
          "polygon": [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
        }],
        "languages": ["en"],
        "image_bbox": [0, 0, width, height]
      }],
      "tables": {
        "bbox_data": [
          {
            "class_id": 0,
            "xyxy": [x1, y1, x2, y2],
            "xywh": [x, y, w, h]
          }
        ],
        "html": ["<table>...</table>", "..."]
      }
    }
  ]
}
```

## Notes for Frontend Integration

When integrating with the frontend, you'll need to:

1. Update API response handling to extract table data
2. Render HTML tables from the `html` field
3. Visualize table bounding boxes with a different color than text boxes
4. Add a toggle to show/hide tables or text

The HTML table output can be rendered directly in React components using `dangerouslySetInnerHTML`:

```jsx
<div dangerouslySetInnerHTML={{ __html: tableHtml }} />
```

Make sure to style the tables appropriately to match your application's design.