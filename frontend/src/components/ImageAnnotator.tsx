'use client';

import { useEffect, useRef, useState } from 'react';
import { TextLine } from '@/types/ocr';

interface ImageAnnotatorProps {
  imageUrl: string;
  textLines: TextLine[];
  onBoxClick: (textLine: TextLine) => void;
  selectedBox?: TextLine;
}

export default function ImageAnnotator({ imageUrl, textLines, onBoxClick, selectedBox }: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [hoveredBox, setHoveredBox] = useState<TextLine | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      setImage(img);
      
      // Calculate scale to fit the image in the viewport
      const maxWidth = window.innerWidth * 0.7;
      const maxHeight = window.innerHeight * 0.8;
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      setScale(Math.min(scaleX, scaleY));
    };
  }, [imageUrl]);

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

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={handleCanvasMouseLeave}
      style={{
        maxWidth: '100%',
        maxHeight: 'calc(100vh - 200px)', // Account for header padding
        cursor: 'pointer',
        objectFit: 'contain',
      }}
    />
  );
}