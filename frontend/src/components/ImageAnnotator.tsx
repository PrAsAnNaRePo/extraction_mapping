'use client';

import { useEffect, useRef, useState } from 'react';
import { OCRResult, OCRTextLine } from '@/types/pdf';

interface ImageAnnotatorProps {
  imageUrl?: string;
  ocrResults: OCRResult[];
  onBoxClick?: (textLine: OCRTextLine) => void;
  selectedBox?: OCRTextLine;
  pageImage?: string;  // base64 encoded image
}

export default function ImageAnnotator({ imageUrl, ocrResults, onBoxClick, selectedBox, pageImage }: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [hoveredBox, setHoveredBox] = useState<OCRTextLine | null>(null);
  const [error, setError] = useState<string>();
  const [zoomLevel, setZoomLevel] = useState(1); // Moved here

  // Flatten all text lines from all OCR results
  const textLines = ocrResults.flatMap(result => result.text_lines);

  useEffect(() => {
    const loadImage = (src: string) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImage(img);
        setError(undefined);
        
        // Calculate scale to fit the image in the viewport
        const maxWidth = window.innerWidth * 0.7;
        const maxHeight = window.innerHeight * 0.8;
        const scaleX = maxWidth / img.width;
        const scaleY = maxHeight / img.height;
        setScale(Math.min(scaleX, scaleY));
      };
      img.onerror = () => {
        setError('Failed to load image');
        setImage(null);
      };
    };

    if (pageImage) {
      loadImage(pageImage);
    } else if (imageUrl) {
      loadImage(imageUrl);
    }
  }, [imageUrl, pageImage]);

  useEffect(() => {
    if (!canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw bounding boxes
    textLines.forEach((line) => {
      const [x, y, x2, y2] = line.bbox;
      const width = (x2 - x) * scale;
      const height = (y2 - y) * scale;

      // Set colors and opacity based on state
      if (line === selectedBox) {
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
      } else if (line === hoveredBox) {
        ctx.strokeStyle = '#ff3333';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.08)';
      } else {
        ctx.strokeStyle = '#ff0000';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.02)';
      }

      ctx.lineWidth = line === selectedBox ? 2 : 1;
      ctx.fillRect(x * scale, y * scale, width, height);
      ctx.strokeRect(x * scale, y * scale, width, height);
    });
  }, [image, textLines, selectedBox, hoveredBox, scale]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };
  
  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const getMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    const displayToActualRatio = {
      x: canvasRef.current.width / rect.width,
      y: canvasRef.current.height / rect.height
    };

    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;

    return {
      x: (displayX * displayToActualRatio.x) / scale,
      y: (displayY * displayToActualRatio.y) / scale
    };
  };

  const findBoxAtPosition = (x: number, y: number) => {
    const sortedBoxes = [...textLines].sort((a, b) => {
      const areaA = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
      const areaB = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
      return areaA - areaB;
    });

    return sortedBoxes.find((line) => {
      const [x1, y1, x2, y2] = line.bbox;
      return x >= (x1 - 1) && x <= (x2 + 1) && y >= (y1 - 1) && y <= (y2 + 1);
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePosition(e);
    if (!pos) return;
    const clickedBox = findBoxAtPosition(pos.x, pos.y);
    if (clickedBox && onBoxClick) {
      onBoxClick(clickedBox);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePosition(e);
    if (!pos) return;
    const hovered = findBoxAtPosition(pos.x, pos.y);
    setHoveredBox(hovered || null);
  };

  const handleCanvasMouseLeave = () => {
    setHoveredBox(null);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    );
  }

  if (!image) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="flex flex-col items-center gap-2">
          <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading page...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-gray-100">
      {/* Controls */}
      <div className="bg-white p-2 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-gray-100 text-gray-700"
            title="Zoom Out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          <span className="text-sm font-medium">{Math.round(zoomLevel * 100)}%</span>
          
          <button 
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-gray-100 text-gray-700"
            title="Zoom In"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          <button 
            onClick={handleResetZoom}
            className="p-1 rounded hover:bg-gray-100 text-gray-700 ml-2"
            title="Reset Zoom"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        {selectedBox && (
          <div className="text-sm text-gray-600">
            Selected: "{selectedBox.text.substring(0, 30)}{selectedBox.text.length > 30 ? '...' : ''}"
          </div>
        )}
        
        <div className="text-sm text-gray-600">
          {textLines.length} text elements detected
        </div>
      </div>
      
      {/* Canvas Container with Overflow */}
      <div className="flex-1 overflow-auto relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
            cursor: textLines.length > 0 ? 'pointer' : 'default',
          }}
        />
      </div>
    </div>
  );
}
