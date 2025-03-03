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
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [hoveredBox, setHoveredBox] = useState<OCRTextLine | null>(null);
  const [error, setError] = useState<string>();
  const [zoomLevel, setZoomLevel] = useState(1);

  // Flatten all text lines from all OCR results
  const textLines = ocrResults.flatMap(result => result.text_lines);
  
  // Handle window resize to redraw canvas
  useEffect(() => {
    const handleResize = () => {
      // Redraw when window is resized
      if (image) {
        const canvas = canvasRef.current;
        if (canvas) {
          // Force redraw by triggering effect dependency
          setScale(prev => prev + 0.001);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image]);

  useEffect(() => {
    const loadImage = (src: string) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImage(img);
        setError(undefined);
        
        // Don't set scale here - we'll calculate it properly when drawing to canvas
        // based on the container dimensions
        setScale(1); // Reset scale to 1, will be calculated in the render function
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

    // Get the actual container dimensions
    const container = canvas.parentElement;
    if (!container) return;

    // Calculate proper scale based on container and image dimensions
    // Measure the available space for the canvas, accounting for any padding/margins
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Adjust for some padding to avoid filling the entire container
    const maxWidth = containerWidth * 0.95;
    const maxHeight = containerHeight * 0.95;
    
    const scaleX = maxWidth / image.width;
    const scaleY = maxHeight / image.height;
    
    // Use the smaller scale to ensure image fits completely with proper aspect ratio
    const newScale = Math.min(scaleX, scaleY);
    setScale(newScale);
    
    // Set canvas size based on the calculated scale to maintain aspect ratio
    canvas.width = image.width * newScale;
    canvas.height = image.height * newScale;
    
    // Track the actual canvas dimensions for calculating relative coordinates
    canvas.dataset.actualWidth = String(canvas.width);
    canvas.dataset.actualHeight = String(canvas.height);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Get OCR image bounds (if available) to properly scale annotations
    let ocrImageWidth = 0;
    let ocrImageHeight = 0;
    
    if (ocrResults.length > 0 && ocrResults[0].image_bbox) {
      // OCR results include the image dimensions used during processing
      // This contains the original dimensions used during OCR analysis
      const [_, __, imgWidth, imgHeight] = ocrResults[0].image_bbox;
      ocrImageWidth = imgWidth;
      ocrImageHeight = imgHeight;
    } else if (image) {
      // Fallback to the natural image dimensions if OCR bounds aren't available
      ocrImageWidth = image.naturalWidth;
      ocrImageHeight = image.naturalHeight;
    }
    
    // Calculate scale factors between OCR coordinates and canvas dimensions
    // This ensures the bounding boxes match the displayed image dimensions
    const xScaleFactor = ocrImageWidth > 0 ? (canvas.width / ocrImageWidth) : newScale;
    const yScaleFactor = ocrImageHeight > 0 ? (canvas.height / ocrImageHeight) : newScale;

    // Store scale factors as data attributes for use by mouse interaction functions
    canvas.dataset.xScale = String(xScaleFactor);
    canvas.dataset.yScale = String(yScaleFactor);

    // Draw bounding boxes with correct scaling
    textLines.forEach((line) => {
      const [x, y, x2, y2] = line.bbox;
      
      // Scale bbox coordinates to match the canvas dimensions
      const scaledX = x * xScaleFactor;
      const scaledY = y * yScaleFactor;
      const scaledWidth = (x2 - x) * xScaleFactor;
      const scaledHeight = (y2 - y) * yScaleFactor;

      // Set colors and opacity based on state
      if (line === selectedBox) {
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
        ctx.lineWidth = 2;
      } else if (line === hoveredBox) {
        ctx.strokeStyle = '#ff3333';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.08)';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = '#ff0000';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.02)';
        ctx.lineWidth = 1;
      }

      // Draw the box
      ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
    });
  }, [image, textLines, selectedBox, hoveredBox, ocrResults, zoomLevel]);

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

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get the stored scale factors
    const xScaleFactor = parseFloat(canvas.dataset.xScale || "1");
    const yScaleFactor = parseFloat(canvas.dataset.yScale || "1");
    
    // These are the click coordinates in browser pixels
    const browserX = e.clientX - rect.left;
    const browserY = e.clientY - rect.top;
    
    // Step 1: Adjust for CSS zoom
    // The canvas appears zoomed by CSS transform, but its internal coordinates are unchanged
    // We need to convert browser pixel position to the pre-zoomed canvas position
    const unzoomedX = browserX / zoomLevel;
    const unzoomedY = browserY / zoomLevel;
    
    // Step 2: Convert to canvas pixel coordinates
    // Since the canvas might be rendered at a different size than its internal pixel dimensions,
    // we need to convert browser space to canvas space
    const canvasScaleX = canvas.width / rect.width * zoomLevel;
    const canvasScaleY = canvas.height / rect.height * zoomLevel;
    
    const canvasX = unzoomedX * canvasScaleX;
    const canvasY = unzoomedY * canvasScaleY;
    
    // Step 3: Convert from canvas coordinates to OCR coordinates
    // The bounding boxes are in OCR coordinate space, not canvas space
    // We need to convert our canvas position to the OCR space
    return {
      x: canvasX / xScaleFactor,
      y: canvasY / yScaleFactor
    };
  };

  const findBoxAtPosition = (x: number, y: number) => {
    // Calculate margin based on zoom level 
    // When zoomed out, we need a larger margin to make boxes easier to click
    // When zoomed in, we need a smaller margin for precision
    const margin = Math.max(3, 8 / zoomLevel);
    
    // Filter boxes that contain the point or are very close to it
    const nearbyBoxes = textLines.filter((line) => {
      const [x1, y1, x2, y2] = line.bbox;
      
      // Check if point is inside or near the box
      const isNearby = (
        x >= (x1 - margin) && 
        x <= (x2 + margin) && 
        y >= (y1 - margin) && 
        y <= (y2 + margin)
      );
      
      return isNearby;
    });
    
    if (nearbyBoxes.length === 0) {
      return null;
    }
    
    // If the click is directly inside a box, prioritize that box
    const directHits = nearbyBoxes.filter(line => {
      const [x1, y1, x2, y2] = line.bbox;
      return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    });
    
    if (directHits.length > 0) {
      // If we have direct hits, prioritize the smallest one
      return directHits.sort((a, b) => {
        const areaA = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
        const areaB = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
        return areaA - areaB; // Sort by area, smallest first
      })[0];
    }
    
    // Otherwise, for nearby boxes, prioritize by distance to center
    return nearbyBoxes.sort((a, b) => {
      // Calculate centers
      const centerA = {
        x: (a.bbox[0] + a.bbox[2]) / 2,
        y: (a.bbox[1] + a.bbox[3]) / 2
      };
      
      const centerB = {
        x: (b.bbox[0] + b.bbox[2]) / 2,
        y: (b.bbox[1] + b.bbox[3]) / 2
      };
      
      // Calculate squared distances (avoid square root for performance)
      const distanceA = Math.pow(centerA.x - x, 2) + Math.pow(centerA.y - y, 2);
      const distanceB = Math.pow(centerB.x - x, 2) + Math.pow(centerB.y - y, 2);
      
      return distanceA - distanceB; // Sort by distance, closest first
    })[0];
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
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto relative flex items-center justify-center"
      >
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
