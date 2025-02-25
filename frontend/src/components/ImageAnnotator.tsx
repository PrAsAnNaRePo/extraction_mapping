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

    // Convert to image coordinates
    return {
      x: actualX / scale,
      y: actualY / scale
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

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePosition(e);
    if (!pos) return;

    const clickedBox = findBoxAtPosition(pos.x, pos.y);
    if (clickedBox) {
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
    <div className="relative w-full h-full flex items-center justify-center bg-gray-100">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        style={{
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 200px)', // Account for header padding
          cursor: textLines.length > 0 ? 'pointer' : 'default',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}