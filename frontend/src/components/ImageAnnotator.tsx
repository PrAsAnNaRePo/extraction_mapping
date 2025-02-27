'use client';

import { useEffect, useRef, useState } from 'react';
import { OCRResult, OCRTextLine, TableBBox } from '@/types/pdf';

interface ImageAnnotatorProps {
  imageUrl?: string;
  ocrResults: OCRResult[];
  onBoxClick?: (textLine: OCRTextLine) => void;
  selectedBox?: OCRTextLine;
  pageImage?: string;  // base64 encoded image
  tableData?: TableBBox[];
  onTableClick?: (tableBox: TableBBox) => void;
  selectedTable?: TableBBox;
  showTables?: boolean;
}

export default function ImageAnnotator({ 
  imageUrl, 
  ocrResults, 
  onBoxClick, 
  selectedBox, 
  pageImage,
  tableData = [],
  onTableClick,
  selectedTable,
  showTables = true
}: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [hoveredBox, setHoveredBox] = useState<OCRTextLine | null>(null);
  const [hoveredTable, setHoveredTable] = useState<TableBBox | null>(null);
  const [error, setError] = useState<string>();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Flatten all text lines from all OCR results
  const textLines = ocrResults.flatMap(result => result.text_lines);

  // Handle zoom in/out
  const handleZoom = (delta: number) => {
    setZoomLevel(prevZoom => {
      const newZoom = Math.max(0.5, Math.min(5, prevZoom + delta * 0.1));
      return newZoom;
    });
  };

  // Reset zoom and position
  const resetView = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    const loadImage = (src: string) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImage(img);
        setError(undefined);
        resetView(); // Reset zoom and position when new image loads
        
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

    // Set canvas size based on scale and zoom
    const effectiveScale = scale * zoomLevel;
    canvas.width = image.width * effectiveScale;
    canvas.height = image.height * effectiveScale;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformation for zoom and pan
    ctx.save();
    ctx.translate(position.x, position.y);
    
    // Draw image with the effective scale
    ctx.drawImage(image, 0, 0, canvas.width / zoomLevel, canvas.height / zoomLevel);

    // Draw table bounding boxes
    if (showTables && tableData && tableData.length > 0) {
      tableData.forEach((table) => {
        const [x, y, x2, y2] = table.xyxy;
        const width = (x2 - x) * effectiveScale;
        const height = (y2 - y) * effectiveScale;

        // Set colors and opacity based on state
        if (table === selectedTable) {
          ctx.strokeStyle = '#2563eb'; // blue-600
          ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
        } else if (table === hoveredTable) {
          ctx.strokeStyle = '#4f46e5'; // indigo-600
          ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
        } else {
          ctx.strokeStyle = '#6366f1'; // indigo-500
          ctx.fillStyle = 'rgba(99, 102, 241, 0.06)';
        }

        ctx.lineWidth = table === selectedTable ? 3 : 2;
        ctx.fillRect(x * effectiveScale, y * effectiveScale, width, height);
        ctx.strokeRect(x * effectiveScale, y * effectiveScale, width, height);
      });
    }

    // Draw text bounding boxes
    textLines.forEach((line) => {
      const [x, y, x2, y2] = line.bbox;
      const width = (x2 - x) * effectiveScale;
      const height = (y2 - y) * effectiveScale;

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
      ctx.fillRect(x * effectiveScale, y * effectiveScale, width, height);
      ctx.strokeRect(x * effectiveScale, y * effectiveScale, width, height);
    });
    
    // Restore context state
    ctx.restore();
  }, [image, textLines, selectedBox, hoveredBox, tableData, selectedTable, hoveredTable, scale, zoomLevel, position, showTables]);

  const getMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    // Calculate the ratio of the canvas display size to its actual size
    const displayToActualRatio = {
      x: canvasRef.current.width / rect.width,
      y: canvasRef.current.height / rect.height
    };

    // Get position in display coordinates
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;

    // Convert to actual canvas coordinates
    const actualX = displayX * displayToActualRatio.x;
    const actualY = displayY * displayToActualRatio.y;

    // Adjust for pan and zoom
    const adjustedX = (actualX - position.x) / zoomLevel;
    const adjustedY = (actualY - position.y) / zoomLevel;

    // Convert to image coordinates
    return {
      x: adjustedX / scale,
      y: adjustedY / scale
    };
  };

  const findBoxAtPosition = (x: number, y: number) => {
    // Sort boxes by area (ascending) so smaller boxes get priority
    const sortedBoxes = [...textLines].sort((a, b) => {
      const areaA = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
      const areaB = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
      return areaA - areaB;
    });

    // Find the smallest box that contains the point
    return sortedBoxes.find((line) => {
      const [x1, y1, x2, y2] = line.bbox;
      // Add a small padding (1 pixel) to make selection easier
      return x >= (x1 - 1) && x <= (x2 + 1) && y >= (y1 - 1) && y <= (y2 + 1);
    });
  };

  const findTableAtPosition = (x: number, y: number) => {
    if (!tableData || tableData.length === 0) return null;
    
    // Sort tables by area (ascending) so smaller tables get priority
    const sortedTables = [...tableData].sort((a, b) => {
      const areaA = (a.xyxy[2] - a.xyxy[0]) * (a.xyxy[3] - a.xyxy[1]);
      const areaB = (b.xyxy[2] - b.xyxy[0]) * (b.xyxy[3] - b.xyxy[1]);
      return areaA - areaB;
    });

    // Find the smallest table that contains the point
    return sortedTables.find((table) => {
      const [x1, y1, x2, y2] = table.xyxy;
      // Add a small padding (1 pixel) to make selection easier
      return x >= (x1 - 1) && x <= (x2 + 1) && y >= (y1 - 1) && y <= (y2 + 1);
    });
  };

  // Handle mouse events for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only start dragging on middle mouse button (wheel) or when holding Ctrl
    if (e.button === 1 || e.ctrlKey) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      e.preventDefault(); // Prevent text selection
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle dragging (panning)
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    // Handle hover over boxes when not dragging
    const pos = getMousePosition(e);
    if (!pos) return;

    // First check if hovering over a table
    if (showTables && tableData && tableData.length > 0) {
      const hoveredTableItem = findTableAtPosition(pos.x, pos.y);
      setHoveredTable(hoveredTableItem || null);
      
      // If hovering over a table, don't show text box hover
      if (hoveredTableItem) {
        setHoveredBox(null);
        return;
      }
    } else {
      setHoveredTable(null);
    }

    // If not hovering over a table, check for text boxes
    const hoveredBoxItem = findBoxAtPosition(pos.x, pos.y);
    setHoveredBox(hoveredBoxItem || null);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredBox(null);
    setHoveredTable(null);
  };

  // Handle mouse wheel for zooming
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault(); // Prevent page zoom
      const delta = -Math.sign(e.deltaY);
      handleZoom(delta);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't trigger click events when dragging
    if (isDragging) return;
    
    const pos = getMousePosition(e);
    if (!pos) return;

    // First check if a table was clicked
    if (showTables && tableData && tableData.length > 0) {
      const clickedTable = findTableAtPosition(pos.x, pos.y);
      if (clickedTable && onTableClick) {
        onTableClick(clickedTable);
        return;
      }
    }

    // If no table was clicked or tables aren't shown, check for text boxes
    const clickedBox = findBoxAtPosition(pos.x, pos.y);
    if (clickedBox && onBoxClick) {
      onBoxClick(clickedBox);
    }
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
    <div 
      ref={containerRef}
      className="relative w-full h-full flex flex-col items-center justify-center bg-gray-100"
    >
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex space-x-2">
        <button 
          onClick={() => handleZoom(1)} 
          className="p-1 bg-white rounded-full shadow hover:bg-gray-100"
          title="Zoom in"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button 
          onClick={() => handleZoom(-1)} 
          className="p-1 bg-white rounded-full shadow hover:bg-gray-100"
          title="Zoom out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
          </svg>
        </button>
        <button 
          onClick={resetView} 
          className="p-1 bg-white rounded-full shadow hover:bg-gray-100"
          title="Reset view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Zoom info */}
      <div className="absolute top-2 left-2 z-10 bg-white/80 rounded px-2 py-1 text-xs">
        Zoom: {Math.round(zoomLevel * 100)}% | 
        {isDragging ? ' Panning...' : ' Ctrl+Click or middle mouse to pan, Ctrl+Wheel to zoom'}
      </div>

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        style={{
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 200px)', // Account for header padding
          cursor: isDragging 
            ? 'grabbing' 
            : hoveredBox || hoveredTable 
              ? 'pointer' 
              : textLines.length > 0 || (tableData && tableData.length > 0) 
                ? 'crosshair' 
                : 'default',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}