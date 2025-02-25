# Engineering Drawing Text Extraction & Mapping

A full-stack application for extracting and visualizing text from engineering drawings using OCR technology. The application provides an interactive interface to view and analyze text annotations in engineering drawings with bounding box visualization.

![Project Demo](demo.gif)

## Features

- 📄 **PDF Processing**:
  - Support for multi-page PDF documents
  - Flexible page selection (ranges, individual pages, all pages)
  - Page-level processing and visualization
  - Efficient page caching and management

- 🔍 **Text Extraction**:
  - Advanced OCR for engineering drawings
  - Support for both PDFs and images (PNG, JPG, JPEG)
  - High accuracy text detection and recognition
  - Multi-language support

- 🎯 **Interactive Visualization**: 
  - Dynamic bounding box display
  - Hover and click interactions
  - Synchronized text selection
  - Page-level navigation with tabs

- 📊 **Detailed Information**:
  - Extracted text content
  - Confidence scores
  - Bounding box coordinates
  - Page-specific results

- 🎨 **Modern UI/UX**:
  - Clean, responsive design
  - Smooth animations and transitions
  - Intuitive page navigation
  - Real-time processing feedback

## Project Structure

```
extraction_mapping/
├── backend/
│   ├── app.py           # FastAPI server
│   ├── test.py          # API testing script
│   └── readme.md        # Backend documentation
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js app directory
│   │   ├── components/  # React components
│   │   └── types/      # TypeScript definitions
│   ├── public/         # Static assets
│   └── package.json    # Dependencies and scripts
└── README.md           # Project documentation
```

## Prerequisites

- Node.js (v18 or higher)
- Python (v3.8 or higher)
- pip (Python package manager)
- npm (Node package manager)

## Installation & Setup

### 1. Backend Setup

Navigate to the backend directory:
```bash
cd extraction_mapping/backend
```

Install Python dependencies:
```bash
pip install surya_ocr fastapi uvicorn python-multipart
```

Start the backend server:
```bash
uvicorn app:app --host 0.0.0.0 --port 3002
```

The backend server will be available at http://localhost:3002

### 2. Frontend Setup

Navigate to the frontend directory:
```bash
cd extraction_mapping/frontend
```

Install Node dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev -- -p 55630
```

The frontend application will be available at http://localhost:55630

## Usage Guide

1. **Upload a Document**
   - Click the file input or drag & drop
   - Select a PDF or image file
   - Supported formats:
     - PDF (multi-page documents)
     - Images (PNG, JPG, JPEG)

2. **Select Pages to Process**
   - For PDFs, specify pages to process:
     - Range format: "1-3"
     - Individual pages: "1,3,5"
     - Combined: "1-3,5,7-9"
     - All pages: "all"
   - For images, the entire image is processed

3. **Process and View Results**
   - Click "Process Pages" button
   - Monitor processing progress
   - Navigate processed pages using tabs
   - View results in split-screen layout

4. **Interact with Results**
   - **View Bounding Boxes**:
     - Hover over boxes to highlight them
     - Click a box to select it
     - Selected boxes are highlighted in green
   
   - **View Extracted Text**:
     - Text sidebar shows page-specific results
     - Each text entry displays:
       - Extracted text content
       - Confidence score
       - Coordinates
     - Click text to highlight corresponding box
     - Auto-scroll to selected text

5. **Navigation and Tools**
   - Switch between pages using tabs
   - Independently scrollable text sidebar
   - Real-time synchronization between views
   - Automatic page image caching
   - Clear visual feedback for all actions

## Technical Details

### Backend

- **Framework**: FastAPI
- **OCR Engine**: surya_ocr
- **PDF Processing**: PyPDF2, pdf2image
- **Features**:
  - Fast text detection and recognition
  - PDF page extraction and conversion
  - Multi-page processing
  - Confidence scoring
  - Bounding box coordinates
  - Multi-language support
  - CORS enabled for frontend access

### Frontend

- **Framework**: Next.js 13+
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Key Libraries**:
  - axios: API requests
  - HTML Canvas: Bounding box rendering
  - React Hooks: State management
  - PDF handling and caching

### API Endpoints

```
POST /pdf-info
- Accepts: multipart/form-data with 'file' field (PDF)
- Returns: Basic PDF information
```

```
POST /process-pdf
- Accepts: multipart/form-data with 'file' and 'page_selection' fields
- Returns: OCR results for selected pages
```

```
POST /get-page-image
- Accepts: multipart/form-data with 'file' and 'page' fields
- Returns: Base64 encoded page image
```

```
POST /ocr
- Accepts: multipart/form-data with 'file' field (image)
- Returns: OCR results for single image
```

Example Response (process-pdf):
```json
{
  "total_pages": 5,
  "processed_pages": [
    {
      "page": 1,
      "ocr_data": [{
        "text_lines": [{
          "text": "Example Text",
          "confidence": 0.95,
          "bbox": [x1, y1, x2, y2],
          "polygon": [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
        }],
        "languages": ["en"],
        "image_bbox": [0, 0, width, height]
      }]
    }
  ]
}
```

## Performance Considerations

- **PDF Processing**:
  - Optimal performance with PDFs up to 100MB
  - Efficient page-by-page processing
  - Image caching for faster navigation
  - Memory-efficient page handling

- **Image Processing**:
  - Optimal size: up to 4000x4000 pixels
  - Processing time: 1-3 seconds per page
  - Automatic image optimization
  - Efficient memory management

- **System Requirements**:
  - Modern browsers (Chrome, Firefox, Safari, Edge)
  - Minimum 4GB RAM recommended
  - Stable internet connection
  - Desktop or tablet device

## Development

### Running Tests

Backend tests:
```bash
cd backend
python test.py
```

Frontend tests:
```bash
cd frontend
npm test
```

### Building for Production

Frontend:
```bash
cd frontend
npm run build
```

### Environment Setup

Required system packages:
```bash
# For PDF processing
apt-get install poppler-utils

# For OCR dependencies
pip install surya_ocr PyPDF2 pdf2image
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Acknowledgments

- surya_ocr team for the OCR engine
- Next.js team for the frontend framework
- FastAPI team for the backend framework
- PyPDF2 and pdf2image teams for PDF processing

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

## Roadmap

- [x] Multi-page PDF support
- [x] Page selection and navigation
- [x] Image caching and optimization
- [ ] Batch processing for multiple PDFs
- [ ] Export functionality (PDF annotations, CSV)
- [ ] Advanced text search and filtering
- [ ] Document comparison tools
- [ ] Integration with CAD software
- [ ] Mobile device support
- [ ] OCR language selection
- [ ] Custom annotation tools
