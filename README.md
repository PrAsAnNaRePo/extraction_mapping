# Engineering Drawing Text Extraction & Mapping

A full-stack application for extracting and visualizing text from engineering drawings using OCR technology. The application provides an interactive interface to view and analyze text annotations in engineering drawings with bounding box visualization.

![Project Demo](demo.gif)

## Features

- 🖼️ **Image Upload**: Support for various image formats (PNG, JPG, JPEG)
- 📝 **Text Extraction**: Advanced OCR to detect and extract text from engineering drawings
- 🎯 **Interactive Visualization**: 
  - Dynamic bounding box display
  - Hover and click interactions
  - Synchronized text selection
- 📊 **Detailed Information**:
  - Extracted text content
  - Confidence scores
  - Bounding box coordinates
- 🎨 **Modern UI/UX**:
  - Clean, responsive design
  - Smooth animations
  - Clear visual hierarchy

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
\`\`\`bash
cd extraction_mapping/backend
\`\`\`

Install Python dependencies:
\`\`\`bash
pip install surya_ocr fastapi uvicorn python-multipart
\`\`\`

Start the backend server:
\`\`\`bash
uvicorn app:app --host 0.0.0.0 --port 3002
\`\`\`

The backend server will be available at http://localhost:3002

### 2. Frontend Setup

Navigate to the frontend directory:
\`\`\`bash
cd extraction_mapping/frontend
\`\`\`

Install Node dependencies:
\`\`\`bash
npm install
\`\`\`

Start the development server:
\`\`\`bash
npm run dev -- -p 55630
\`\`\`

The frontend application will be available at http://localhost:55630

## Usage Guide

1. **Upload an Image**
   - Click the file input at the top of the page
   - Select an engineering drawing image file
   - Supported formats: PNG, JPG, JPEG

2. **Process the Image**
   - Click the "Process Image" button
   - Wait for the OCR processing to complete
   - The extracted text and bounding boxes will appear

3. **Interact with Results**
   - **View Bounding Boxes**:
     - Hover over boxes to highlight them
     - Click a box to select it
     - Selected boxes are highlighted in green
   
   - **View Extracted Text**:
     - All extracted text appears in the sidebar
     - Each text entry shows:
       - The extracted text content
       - Confidence score
     - Click text entries to highlight corresponding boxes
     - Auto-scrolls to selected text

4. **Navigation**
   - The image view remains fixed while scrolling
   - Sidebar content is independently scrollable
   - Selected text automatically scrolls into view

## Technical Details

### Backend

- **Framework**: FastAPI
- **OCR Engine**: surya_ocr
- **Features**:
  - Fast text detection and recognition
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

### API Endpoints

```
POST /ocr
- Accepts: multipart/form-data with 'file' field
- Returns: JSON with OCR results
```

Example Response:
```
{
  "results": [{
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
```

## Performance Considerations

- **Image Size**: Optimal performance with images up to 4000x4000 pixels
- **Processing Time**: Typically 1-3 seconds per image
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Responsive Design**: Works on desktop and tablet devices

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

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

## Roadmap

- [ ] Support for multiple image upload
- [ ] Batch processing capabilities
- [ ] Export functionality for extracted data
- [ ] Advanced filtering and search options
- [ ] Integration with CAD software
- [ ] Mobile device support
