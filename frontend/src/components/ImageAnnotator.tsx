'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Annotation, AnnotationType, OCRResult, OCRTextLine } from '@/types/pdf';
import AnnotationControls from './AnnotationControls';

interface ImageAnnotatorProps {
  imageUrl?: string;
  ocrResults: OCRResult[];
  onBoxClick?: (textLine: OCRTextLine) => void;
  selectedBox?: OCRTextLine;
  pageImage?: string;  // base64 encoded image
  
  // Annotation props
  annotationMode?: boolean;
  currentAnnotationType?: AnnotationType;
  annotations?: Annotation[];
  onAnnotationModeToggle?: () => void;
  onAnnotationTypeChange?: (type: AnnotationType) => void;
  onCreateAnnotation?: (annotation: Omit<Annotation, 'id'>) => void;
  onUpdateAnnotation?: (id: string, bbox: [number, number, number, number]) => void;
  onDeleteAnnotation?: (id: string) => void;
  onSelectAnnotation?: (id: string) => void;
  onDetectTables?: () => void;
  onProcessAnnotations?: () => void;
  
  // Rotation props
  rotation?: number;
  onRotationChange?: (rotation: number) => void;
}

export default function ImageAnnotator({ 
  imageUrl, 
  ocrResults, 
  onBoxClick, 
  selectedBox, 
  pageImage,
  annotationMode = false,
  currentAnnotationType = AnnotationType.TEXT,
  annotations = [],
  onAnnotationModeToggle,
  onAnnotationTypeChange,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onSelectAnnotation,
  onDetectTables,
  onProcessAnnotations,
  rotation = 0,
  onRotationChange
}: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [hoveredBox, setHoveredBox] = useState<OCRTextLine | null>(null);
  const [error, setError] = useState<string>();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [localRotation, setLocalRotation] = useState(rotation); // Internal rotation state
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  
  // New state for panning functionality
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Annotation related states
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number, y: number } | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null); // 'tl', 'tr', 'bl', 'br', null
  const [initialBbox, setInitialBbox] = useState<[number, number, number, number] | null>(null);

  // Flatten all text lines from all OCR results
  const textLines = ocrResults.flatMap(result => result.text_lines);
  
  // Helper function to get the effective rotation
  const getEffectiveRotation = useCallback(() => {
    // Use controlled rotation if provided, otherwise use local state
    return onRotationChange ? rotation : localRotation;
  }, [onRotationChange, rotation, localRotation]);
  
  // Helper to check if rotation is 90 or 270 degrees
  const isRotated90or270 = useCallback(() => {
    const currentRotation = getEffectiveRotation();
    return currentRotation === 90 || currentRotation === 270;
  }, [getEffectiveRotation]);
  
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
    const loadImage = async (src: string) => {
      setIsLoading(true);
      setError(undefined);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      try {
        await new Promise((resolve, reject) => {
          img.onload = () => {
            console.log(`Image loaded: ${img.naturalWidth}x${img.naturalHeight}`);
            resolve(null);
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = src;
        });

        setImage(img);
        
        // Immediately render the image if canvas is ready
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          // Set initial canvas size to match image
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
        }
      } catch (err) {
        console.error('Image load error:', err);
        setError('Failed to load image');
        setImage(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (pageImage || imageUrl) {
      loadImage(pageImage || imageUrl);
    }
  }, [imageUrl, pageImage]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate dimensions
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // Get effective dimensions based on rotation
    const dimensionsRotated = isRotated90or270();
    const effectiveImageWidth = dimensionsRotated ? image.naturalHeight : image.naturalWidth;
    const effectiveImageHeight = dimensionsRotated ? image.naturalWidth : image.naturalHeight;
    
    // Calculate scale to fit container while maintaining aspect ratio
    const containerAspect = containerRect.width / containerRect.height;
    const imageAspect = effectiveImageWidth / effectiveImageHeight;
    
    let newWidth, newHeight;
    if (containerAspect > imageAspect) {
      // Container is wider than image
      newHeight = containerRect.height;
      newWidth = newHeight * imageAspect;
    } else {
      // Container is taller than image
      newWidth = containerRect.width;
      newHeight = newWidth / imageAspect;
    }

    // Update canvas size and clear it
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Set up high quality rendering with optimal settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = 'source-over';
    
    // Apply image enhancement filters
    ctx.filter = 'contrast(1.1) saturate(1.05) brightness(1.02)';

    // Save the current context state and set up transformation
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((localRotation * Math.PI) / 180);

    // Draw image with proper dimensions based on rotation
    const drawRotated = isRotated90or270();
    const drawWidth = drawRotated ? canvas.height : canvas.width;
    const drawHeight = drawRotated ? canvas.width : canvas.height;
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    // Restore the context state
    ctx.restore();
    
    // Calculate and set the scale based on the new dimensions
    const newScale = canvas.width / effectiveImageWidth;
    console.log(`Calculated scale: ${newScale.toFixed(2)}`);
    setScale(newScale);
    
    // Track the actual canvas dimensions for relative coordinates
    canvas.dataset.actualWidth = String(canvas.width);
    canvas.dataset.actualHeight = String(canvas.height);
    canvas.dataset.rotation = String(localRotation);
    
    // Reset filter for subsequent rendering operations
    ctx.filter = 'none';

    // Get OCR image bounds (if available) to properly scale annotations
    let ocrImageWidth = image.naturalWidth;
    let ocrImageHeight = image.naturalHeight;
    
    if (ocrResults.length > 0 && ocrResults[0].image_bbox) {
      // Use OCR dimensions if available, as they represent the original analysis dimensions
      const [_, __, imgWidth, imgHeight] = ocrResults[0].image_bbox;
      ocrImageWidth = imgWidth || ocrImageWidth;
      ocrImageHeight = imgHeight || ocrImageHeight;
    }
    
    // Calculate scale factors between OCR coordinates and canvas dimensions
    // This ensures annotations match the displayed image dimensions
    const scaleRotated = isRotated90or270();
    const xScaleFactor = scaleRotated
      ? canvas.height / ocrImageWidth 
      : canvas.width / ocrImageWidth;
      
    const yScaleFactor = scaleRotated
      ? canvas.width / ocrImageHeight 
      : canvas.height / ocrImageHeight;

    // Store scale factors as data attributes for use by mouse interaction functions
    canvas.dataset.xScale = String(xScaleFactor);
    canvas.dataset.yScale = String(yScaleFactor);

    // Draw OCR text bounding boxes with correct scaling (if not in annotation mode)
    if (!annotationMode) {
      textLines.forEach((line) => {
        const [x, y, x2, y2] = line.bbox;
        
        // Scale and transform bbox coordinates based on rotation
        let scaledX, scaledY, scaledWidth, scaledHeight;
        
        switch (getEffectiveRotation()) {
          case 90:
            // 90 degree rotation - swap coordinates and adjust for rotation
            scaledX = canvas.width - (y + (y2 - y)) * yScaleFactor;
            scaledY = x * xScaleFactor;
            scaledWidth = (y2 - y) * yScaleFactor;
            scaledHeight = (x2 - x) * xScaleFactor;
            break;
            
          case 180:
            // 180 degree rotation - invert coordinates
            scaledX = canvas.width - (x + (x2 - x)) * xScaleFactor;
            scaledY = canvas.height - (y + (y2 - y)) * yScaleFactor;
            scaledWidth = (x2 - x) * xScaleFactor;
            scaledHeight = (y2 - y) * yScaleFactor;
            break;
            
          case 270:
            // 270 degree rotation - swap coordinates and adjust for rotation
            scaledX = y * yScaleFactor;
            scaledY = canvas.height - (x + (x2 - x)) * xScaleFactor;
            scaledWidth = (y2 - y) * yScaleFactor;
            scaledHeight = (x2 - x) * xScaleFactor;
            break;
            
          case 0:
          default:
            // No rotation needed
            scaledX = x * xScaleFactor;
            scaledY = y * yScaleFactor;
            scaledWidth = (x2 - x) * xScaleFactor;
            scaledHeight = (y2 - y) * yScaleFactor;
            break;
        }

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
    }

    // Draw user annotations
    if (annotations && annotations.length > 0) {
      annotations.forEach((annotation) => {
        const [x, y, x2, y2] = annotation.bbox;
        
        // Scale and transform bbox coordinates based on rotation
        let scaledX, scaledY, scaledWidth, scaledHeight;
        
        switch (getEffectiveRotation()) {
          case 90:
            // 90 degree rotation - swap coordinates and adjust for rotation
            scaledX = canvas.width - (y + (y2 - y)) * yScaleFactor;
            scaledY = x * xScaleFactor;
            scaledWidth = (y2 - y) * yScaleFactor;
            scaledHeight = (x2 - x) * xScaleFactor;
            break;
            
          case 180:
            // 180 degree rotation - invert coordinates
            scaledX = canvas.width - (x + (x2 - x)) * xScaleFactor;
            scaledY = canvas.height - (y + (y2 - y)) * yScaleFactor;
            scaledWidth = (x2 - x) * xScaleFactor;
            scaledHeight = (y2 - y) * yScaleFactor;
            break;
            
          case 270:
            // 270 degree rotation - swap coordinates and adjust for rotation
            scaledX = y * yScaleFactor;
            scaledY = canvas.height - (x + (x2 - x)) * xScaleFactor;
            scaledWidth = (y2 - y) * yScaleFactor;
            scaledHeight = (x2 - x) * xScaleFactor;
            break;
            
          case 0:
          default:
            // No rotation needed
            scaledX = x * xScaleFactor;
            scaledY = y * yScaleFactor;
            scaledWidth = (x2 - x) * xScaleFactor;
            scaledHeight = (y2 - y) * yScaleFactor;
            break;
        }

        // Check if this annotation is selected
        const isSelected = annotation.id === selectedAnnotation;

        // Set style based on annotation type and selection state
        let fillOpacity = isSelected ? 0.25 : 0.15; // More opacity when selected
        switch (annotation.type) {
          case AnnotationType.TEXT:
            ctx.strokeStyle = '#22c55e'; // green
            ctx.fillStyle = `rgba(34, 197, 94, ${fillOpacity})`;
            break;
          case AnnotationType.TABLE:
            ctx.strokeStyle = '#eab308'; // yellow
            ctx.fillStyle = `rgba(234, 179, 8, ${fillOpacity})`;
            break;
          case AnnotationType.DIAGRAM:
            ctx.strokeStyle = '#a855f7'; // purple
            ctx.fillStyle = `rgba(168, 85, 247, ${fillOpacity})`;
            break;
          default:
            ctx.strokeStyle = '#3b82f6'; // blue
            ctx.fillStyle = `rgba(59, 130, 246, ${fillOpacity})`;
        }

        // Draw the annotation rectangle
        ctx.lineWidth = isSelected ? 3 : 2; // Thicker border when selected
        ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
        
        // Draw the border with a different style if selected
        if (isSelected) {
          ctx.setLineDash([5, 3]); // Dashed line for selected annotations
        }
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
        ctx.setLineDash([]); // Reset to solid line
        
        // Add label for annotation type
        ctx.font = '12px Arial';
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillText(annotation.type.toUpperCase(), scaledX + 5, scaledY + 16);
        
        // Add processing status indicator
        const statusIcon = annotation.processed ? '✓' : '⏳';
        ctx.fillText(statusIcon, scaledX + scaledWidth - 20, scaledY + 16);
        
        // Draw resize handles if selected (only in annotation mode)
        if (isSelected && annotationMode) {
          const handleSize = 8;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          
          // Draw the four corner handles
          // Top-left
          ctx.beginPath();
          ctx.rect(scaledX - handleSize/2, scaledY - handleSize/2, handleSize, handleSize);
          ctx.fill();
          ctx.stroke();
          
          // Top-right
          ctx.beginPath();
          ctx.rect(scaledX + scaledWidth - handleSize/2, scaledY - handleSize/2, handleSize, handleSize);
          ctx.fill();
          ctx.stroke();
          
          // Bottom-left
          ctx.beginPath();
          ctx.rect(scaledX - handleSize/2, scaledY + scaledHeight - handleSize/2, handleSize, handleSize);
          ctx.fill();
          ctx.stroke();
          
          // Bottom-right
          ctx.beginPath();
          ctx.rect(scaledX + scaledWidth - handleSize/2, scaledY + scaledHeight - handleSize/2, handleSize, handleSize);
          ctx.fill();
          ctx.stroke();
          
          // Draw delete button if selected
          const deleteButtonSize = 16;
          ctx.fillStyle = '#ef4444'; // Red background
          
          // Position delete button and text based on rotation
          let deleteButtonX, deleteButtonY, textX, textY;
          const padding = 5;
          const textPadding = 12; // Distance from button to text
          
          switch (getEffectiveRotation()) {
            case 90:
              // Top-left corner
              deleteButtonX = scaledX + padding;
              deleteButtonY = scaledY + padding;
              textX = deleteButtonX + deleteButtonSize + padding;
              textY = deleteButtonY + textPadding;
              break;
              
            case 180:
              // Bottom-left corner
              deleteButtonX = scaledX + padding;
              deleteButtonY = scaledY + scaledHeight - deleteButtonSize - padding;
              textX = deleteButtonX + deleteButtonSize + padding;
              textY = deleteButtonY + textPadding;
              break;
              
            case 270:
              // Bottom-right corner
              deleteButtonX = scaledX + scaledWidth - deleteButtonSize - padding;
              deleteButtonY = scaledY + scaledHeight - deleteButtonSize - padding;
              textX = deleteButtonX - textPadding;
              textY = deleteButtonY + textPadding;
              break;
              
            case 0:
            default:
              // Top-right corner (default)
              deleteButtonX = scaledX + scaledWidth - deleteButtonSize - padding;
              deleteButtonY = scaledY + padding;
              textX = deleteButtonX - textPadding;
              textY = deleteButtonY + textPadding;
              break;
          }
          
          ctx.beginPath();
          ctx.rect(deleteButtonX, deleteButtonY, deleteButtonSize, deleteButtonSize);
          ctx.fill();
          ctx.stroke();
          
          // Add an X to the delete button
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Arial';
          ctx.fillText('×', textX, textY);
        }
      });
    }

    // Draw the current selection rectangle if the user is drawing
    if (isDrawing && startPoint && currentPoint) {
      // Get the drawing rectangle coordinates in image space
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const width = Math.abs(currentPoint.x - startPoint.x);
      const height = Math.abs(currentPoint.y - startPoint.y);
      
      // Convert to canvas space
      let scaledX = x * xScaleFactor;
      let scaledY = y * yScaleFactor;
      let scaledWidth = width * xScaleFactor;
      let scaledHeight = height * yScaleFactor;
      
      // Transform based on rotation
      let finalX = scaledX;
      let finalY = scaledY;
      let finalWidth = scaledWidth;
      let finalHeight = scaledHeight;
      
      switch (getEffectiveRotation()) {
        case 90:
          // 90 degrees clockwise
          finalX = canvas.width - scaledY - scaledHeight;
          finalY = scaledX;
          finalWidth = scaledHeight;
          finalHeight = scaledWidth;
          break;
          
        case 180:
          // 180 degrees
          finalX = canvas.width - scaledX - scaledWidth;
          finalY = canvas.height - scaledY - scaledHeight;
          break;
          
        case 270:
          // 270 degrees clockwise
          finalX = scaledY;
          finalY = canvas.height - scaledX - scaledWidth;
          finalWidth = scaledHeight;
          finalHeight = scaledWidth;
          break;
      }
      
      // Store the transformed coordinates for reference
      canvas.dataset.lastScaledX = String(finalX);
      canvas.dataset.lastScaledY = String(finalY);
      
      // Set the style based on annotation type
      switch (currentAnnotationType) {
        case AnnotationType.TEXT:
          ctx.strokeStyle = '#22c55e'; // green
          ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
          break;
        case AnnotationType.TABLE:
          ctx.strokeStyle = '#eab308'; // yellow
          ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
          break;
        case AnnotationType.DIAGRAM:
          ctx.strokeStyle = '#a855f7'; // purple
          ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
          break;
        default:
          ctx.strokeStyle = '#3b82f6'; // blue
          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      }
      
      // Draw the selection rectangle with dashed line
      ctx.save();
      ctx.setLineDash([6, 3]);
      ctx.lineWidth = 2;
      
      // Draw the selection rectangle using transformed coordinates
      ctx.fillRect(finalX, finalY, finalWidth, finalHeight);
      ctx.strokeRect(finalX, finalY, finalWidth, finalHeight);
      
      ctx.restore(); // Restore previous canvas state
    }
  }, [
    image, 
    textLines, 
    selectedBox, 
    hoveredBox, 
    ocrResults, 
    zoomLevel, 
    annotationMode, 
    annotations,
    isDrawing,
    startPoint,
    currentPoint,
    currentAnnotationType,
    selectedAnnotation,
    resizeHandle,
    rotation,
    localRotation,
    onRotationChange
  ]);

  // Handle zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // Get mouse position relative to canvas
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate zoom factor based on wheel delta
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoomLevel * zoomFactor, 0.5), 5);
    
    // Calculate new pan offset to zoom toward mouse position
    if (canvasRef.current) {
      const canvasWidth = canvasRef.current.width;
      const canvasHeight = canvasRef.current.height;
      
      // Calculate the point we're zooming to in canvas coordinates
      const pointXBeforeZoom = (mouseX - panOffset.x) / zoomLevel;
      const pointYBeforeZoom = (mouseY - panOffset.y) / zoomLevel;
      
      // Calculate where this point would be after applying the new zoom
      const pointXAfterZoom = pointXBeforeZoom * newZoom;
      const pointYAfterZoom = pointYBeforeZoom * newZoom;
      
      // Adjust the pan offset to keep the mouse position fixed
      const newPanX = panOffset.x - (pointXAfterZoom - pointXBeforeZoom * zoomLevel);
      const newPanY = panOffset.y - (pointYAfterZoom - pointYBeforeZoom * zoomLevel);
      
      setPanOffset({ x: newPanX, y: newPanY });
    }
    
    setZoomLevel(newZoom);
  };
  
  // Enhanced zoom in/out functions
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newZoom = Math.min(prev * 1.2, 5);
      return newZoom;
    });
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev / 1.2, 0.5);
      return newZoom;
    });
  };
  
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };
  
  // Handle panning functionality
  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only start panning if middle mouse button is pressed or space key is held
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };
  
  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };
  
  const handlePanEnd = () => {
    setIsPanning(false);
  };
  
  // Add a state to track Alt key press
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);

  // Handle key press for panning with space bar and Alt key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isPanning) {
        document.body.style.cursor = 'grab';
      }
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltKeyPressed(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        document.body.style.cursor = 'default';
      }
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltKeyPressed(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPanning]);
  
  // Enhanced canvas coordinate conversion function
  const convertBrowserToCanvasCoordinates = (browserX: number, browserY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Account for panning and zooming
    const x = (browserX - rect.left - panOffset.x) / zoomLevel;
    const y = (browserY - rect.top - panOffset.y) / zoomLevel;
    
    // Get the canvas scale factors from data attributes
    const xScale = parseFloat(canvas.dataset.xScale || '1');
    const yScale = parseFloat(canvas.dataset.yScale || '1');
    
    // Convert to image coordinates
    const imageX = x / xScale;
    const imageY = y / yScale;
    
    return { x: imageX, y: imageY };
  };

  const getMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get the stored scale factors
    const xScaleFactor = parseFloat(canvas.dataset.xScale || "1");
    const yScaleFactor = parseFloat(canvas.dataset.yScale || "1");
    
    // Get mouse position in browser coordinates
    const browserX = e.clientX - rect.left;
    const browserY = e.clientY - rect.top;
    
    // Account for panning and zooming
    const adjustedX = (browserX - panOffset.x) / zoomLevel;
    const adjustedY = (browserY - panOffset.y) / zoomLevel;
    
    // Convert to canvas coordinates
    const canvasX = adjustedX * (canvas.width / rect.width);
    const canvasY = adjustedY * (canvas.height / rect.height);
    
    // Transform coordinates based on rotation
    let imageX = canvasX;
    let imageY = canvasY;
    
    const effectiveRotation = getEffectiveRotation();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    switch (effectiveRotation) {
      case 90:
        imageX = canvasY;
        imageY = canvasWidth - canvasX;
        break;
        
      case 180:
        imageX = canvasWidth - canvasX;
        imageY = canvasHeight - canvasY;
        break;
        
      case 270:
        imageX = canvasHeight - canvasY;
        imageY = canvasX;
        break;
    }
    
    // Convert to image coordinates
    return {
      x: imageX / xScaleFactor,
      y: imageY / yScaleFactor
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

  // Find annotation at a given position
  const findAnnotationAtPosition = (x: number, y: number) => {
    if (!annotations || annotations.length === 0 || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const xScaleFactor = parseFloat(canvas.dataset.xScale || "1");
    const yScaleFactor = parseFloat(canvas.dataset.yScale || "1");
    
    // First check if the click is on a resize handle or delete button of the selected annotation
    if (selectedAnnotation && annotationMode) {
      const selected = annotations.find(a => a.id === selectedAnnotation);
      if (selected) {
        const [x1, y1, x2, y2] = selected.bbox;
        
        // Scale bbox coordinates to match the canvas dimensions
        const scaledX = x1 * xScaleFactor;
        const scaledY = y1 * yScaleFactor;
        const scaledWidth = (x2 - x1) * xScaleFactor;
        const scaledHeight = (y2 - y1) * yScaleFactor;
        
        // Scaled click position
        const scaledClickX = x * xScaleFactor;
        const scaledClickY = y * yScaleFactor;
        
        const handleSize = 8;
        
        // Check if click is on delete button
        const deleteButtonSize = 16;
        
        // Position delete button based on rotation
        let deleteButtonX, deleteButtonY;
        const padding = 5;
        
        switch (getEffectiveRotation()) {
          case 90:
            // Top-left corner
            deleteButtonX = scaledX + padding;
            deleteButtonY = scaledY + padding;
            break;
            
          case 180:
            // Bottom-left corner
            deleteButtonX = scaledX + padding;
            deleteButtonY = scaledY + scaledHeight - deleteButtonSize - padding;
            break;
            
          case 270:
            // Bottom-right corner
            deleteButtonX = scaledX + scaledWidth - deleteButtonSize - padding;
            deleteButtonY = scaledY + scaledHeight - deleteButtonSize - padding;
            break;
            
          case 0:
          default:
            // Top-right corner (default)
            deleteButtonX = scaledX + scaledWidth - deleteButtonSize - padding;
            deleteButtonY = scaledY + padding;
            break;
        }
        
        if (
          scaledClickX >= deleteButtonX && 
          scaledClickX <= deleteButtonX + deleteButtonSize &&
          scaledClickY >= deleteButtonY && 
          scaledClickY <= deleteButtonY + deleteButtonSize
        ) {
          return { annotation: selected, handle: 'delete' };
        }
        
        // Check if click is on top-left handle
        if (
          Math.abs(scaledClickX - scaledX) <= handleSize &&
          Math.abs(scaledClickY - scaledY) <= handleSize
        ) {
          return { annotation: selected, handle: 'tl' };
        }
        
        // Check if click is on top-right handle
        if (
          Math.abs(scaledClickX - (scaledX + scaledWidth)) <= handleSize &&
          Math.abs(scaledClickY - scaledY) <= handleSize
        ) {
          return { annotation: selected, handle: 'tr' };
        }
        
        // Check if click is on bottom-left handle
        if (
          Math.abs(scaledClickX - scaledX) <= handleSize &&
          Math.abs(scaledClickY - (scaledY + scaledHeight)) <= handleSize
        ) {
          return { annotation: selected, handle: 'bl' };
        }
        
        // Check if click is on bottom-right handle
        if (
          Math.abs(scaledClickX - (scaledX + scaledWidth)) <= handleSize &&
          Math.abs(scaledClickY - (scaledY + scaledHeight)) <= handleSize
        ) {
          return { annotation: selected, handle: 'br' };
        }
      }
    }
    
    // Check if click is inside any annotation (reverse to select the top-most annotation first)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const annotation = annotations[i];
      const [x1, y1, x2, y2] = annotation.bbox;
      
      if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
        return { annotation, handle: 'move' };
      }
    }
    
    return null;
  };

  // Mouse event handlers for drawing and manipulating annotations
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const pos = getMousePosition(e);
    if (!pos) return;
    
    if (annotationMode) {
      // First check if we're clicking on an existing annotation
      const result = findAnnotationAtPosition(pos.x, pos.y);
      
      if (result) {
        // Handle clicks on existing annotations
        const { annotation, handle } = result;
        
        if (handle === 'delete' && onDeleteAnnotation) {
          // Delete the annotation
          onDeleteAnnotation(annotation.id);
          setSelectedAnnotation(null);
          return;
        }
        
        // Select the annotation
        setSelectedAnnotation(annotation.id);
        
        if (onSelectAnnotation) {
          onSelectAnnotation(annotation.id);
        }
        
        if (handle !== 'move') {
          // We clicked on a resize handle
          setResizeHandle(handle);
          setInitialBbox(annotation.bbox);
        } else {
          // We're moving the entire annotation
          setResizeHandle('move');
          setInitialBbox(annotation.bbox);
        }
        
        // Set start point for moving/resizing
        setIsDrawing(true);
        setStartPoint(pos);
        setCurrentPoint(pos);
      } else {
        // Start drawing a new annotation
        setSelectedAnnotation(null);
        setResizeHandle(null);
        setInitialBbox(null);
        setIsDrawing(true);
        setStartPoint(pos);
        setCurrentPoint(pos);
      }
    }
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const pos = getMousePosition(e);
    if (!pos) return;
    
    const canvas = canvasRef.current;
    
    if (annotationMode) {
      if (isDrawing) {
        setCurrentPoint(pos);
        
        // If we're resizing/moving an annotation, update it in real-time
        if (selectedAnnotation && resizeHandle && initialBbox && onUpdateAnnotation) {
          const [x1, y1, x2, y2] = initialBbox;
          let newBbox: [number, number, number, number] = [...initialBbox] as [number, number, number, number];
          
          // Handle movement/resizing based on the active handle
          const dx = pos.x - startPoint!.x;
          const dy = pos.y - startPoint!.y;
          
          switch (resizeHandle) {
            case 'move':
              // Move the entire annotation
              newBbox = [x1 + dx, y1 + dy, x2 + dx, y2 + dy];
              break;
            case 'tl':
              // Resize from top-left
              newBbox = [Math.min(x1 + dx, x2), Math.min(y1 + dy, y2), x2, y2];
              break;
            case 'tr':
              // Resize from top-right
              newBbox = [x1, Math.min(y1 + dy, y2), Math.max(x2 + dx, x1), y2];
              break;
            case 'bl':
              // Resize from bottom-left
              newBbox = [Math.min(x1 + dx, x2), y1, x2, Math.max(y2 + dy, y1)];
              break;
            case 'br':
              // Resize from bottom-right
              newBbox = [x1, y1, Math.max(x2 + dx, x1), Math.max(y2 + dy, y1)];
              break;
          }
          
          // Update the annotation with the new bbox
          onUpdateAnnotation(selectedAnnotation, newBbox);
        }
      } else {
        // Check if we're hovering over an annotation handle or delete button
        const result = findAnnotationAtPosition(pos.x, pos.y);
        
        // Set appropriate cursor based on what we're hovering over
        if (result) {
          const { handle } = result;
          
          switch (handle) {
            case 'delete':
              canvas.style.cursor = 'pointer';
              break;
            case 'tl':
            case 'br':
              canvas.style.cursor = 'nwse-resize';
              break;
            case 'tr':
            case 'bl':
              canvas.style.cursor = 'nesw-resize';
              break;
            case 'move':
              canvas.style.cursor = 'move';
              break;
          }
        } else {
          canvas.style.cursor = 'crosshair';
        }
      }
    } else {
      // In view mode, handle hovering over OCR boxes
      const hovered = findBoxAtPosition(pos.x, pos.y);
      setHoveredBox(hovered || null);
    }
  };
  
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !annotationMode || !isDrawing || !startPoint) return;
    
    const pos = getMousePosition(e);
    if (!pos) return;
    
    if (resizeHandle && selectedAnnotation) {
      // We were resizing or moving an annotation
      setResizeHandle(null);
      setInitialBbox(null);
    } else {
      // We were drawing a new annotation
      // Check if we have enough area to create an annotation
      const width = Math.abs(pos.x - startPoint.x);
      const height = Math.abs(pos.y - startPoint.y);
      
      if (width > 10 && height > 10 && onCreateAnnotation) {
        // Calculate the bbox coordinates, ensuring we handle drawing in any direction
        const x1 = Math.min(startPoint.x, pos.x);
        const y1 = Math.min(startPoint.y, pos.y);
        const x2 = Math.max(startPoint.x, pos.x);
        const y2 = Math.max(startPoint.y, pos.y);
        
        // Create and pass the annotation to the parent component
        onCreateAnnotation({
          type: currentAnnotationType,
          bbox: [x1, y1, x2, y2] as [number, number, number, number],
          processed: false
        });
      }
    }
    
    // Reset drawing state
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
    
    // Reset cursor style
    if (canvasRef.current) {
      canvasRef.current.style.cursor = annotationMode ? 'crosshair' : 'default';
    }
  };
  
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // This is now mostly handled in mouseDown for better integration with annotation interactions
    if (!annotationMode) {
      const pos = getMousePosition(e);
      if (!pos) return;
      const clickedBox = findBoxAtPosition(pos.x, pos.y);
      if (clickedBox && onBoxClick) {
        onBoxClick(clickedBox);
      }
    }
  };

  const handleCanvasMouseLeave = () => {
    if (isDrawing) {
      // Don't reset selected annotation when leaving canvas, only drawing state
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentPoint(null);
      setResizeHandle(null);
    }
    
    setHoveredBox(null);
    
    // Reset cursor
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  };

  // Handle rotation changes
  const handleRotationChange = (newRotation: number) => {
    setLocalRotation(newRotation);
    if (onRotationChange) {
      onRotationChange(newRotation);
    }
  };
  
  // Rotation handler functions
  const handleRotateLeft = () => {
    const newRotation = (localRotation - 90 + 360) % 360;
    handleRotationChange(newRotation);
  };
  
  const handleRotateRight = () => {
    const newRotation = (localRotation + 90) % 360;
    handleRotationChange(newRotation);
  };
  
  const handleResetRotation = () => {
    handleRotationChange(0);
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
      {!annotationMode ? (
        <div className="bg-white p-2 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Zoom Controls */}
            <div className="flex items-center border-r pr-2 mr-2">
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
                className="p-1 rounded hover:bg-gray-100 text-gray-700 ml-1"
                title="Reset Zoom"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            
            {/* Rotation Controls */}
            <div className="flex items-center border-r pr-2 mr-2">
              <button 
                onClick={handleRotateLeft}
                className="p-1 rounded hover:bg-gray-100 text-gray-700"
                title="Rotate Left 90°"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              
              <span className="text-sm font-medium mx-1">{localRotation}°</span>
              
              <button 
                onClick={handleRotateRight}
                className="p-1 rounded hover:bg-gray-100 text-gray-700"
                title="Rotate Right 90°"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
              
              <button 
                onClick={handleResetRotation}
                className="p-1 rounded hover:bg-gray-100 text-gray-700 ml-1"
                title="Reset Rotation"
                disabled={localRotation === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            
            <button 
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 5))}
              className="p-1 rounded hover:bg-gray-100 text-gray-700"
              title="High Quality Zoom"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            </button>
            
            {onAnnotationModeToggle && (
              <button 
                onClick={onAnnotationModeToggle}
                className="ml-4 px-3 py-1 rounded text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                title="Switch to annotation mode"
              >
                Annotate
              </button>
            )}
          </div>
          
          {selectedBox && (
            <div className="text-sm text-gray-600">
              Selected: "{selectedBox.text.substring(0, 30)}{selectedBox.text.length > 30 ? '...' : ''}"
            </div>
          )}
        </div>
      ) : (
        <AnnotationControls 
          annotationMode={annotationMode}
          onToggleAnnotationMode={onAnnotationModeToggle || (() => {})}
          currentAnnotationType={currentAnnotationType}
          onAnnotationTypeChange={onAnnotationTypeChange || (() => {})}
          onDetectTables={onDetectTables}
          onProcessAnnotations={onProcessAnnotations}
          annotationsCount={annotations?.length || 0}
          rotation={localRotation}
          onRotateLeft={handleRotateLeft}
          onRotateRight={handleRotateRight}
          onResetRotation={handleResetRotation}
          zoomLevel={zoomLevel}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
        />
      )}
      
      {/* Canvas Container with Overflow */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden relative flex items-center justify-center bg-white"
        style={{
          backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%), linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px',
          borderRadius: '4px',
          cursor: isPanning ? 'grabbing' : (isAltKeyPressed ? 'grab' : undefined),
          minHeight: '400px',
          position: 'relative'
        }}
        onWheel={handleWheel}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
            <div className="text-gray-600">Loading image...</div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-500">{error}</div>
          </div>
        )}
        <div
          className="transform-container"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transition: isPanning ? 'none' : 'transform 0.1s ease',
            transformOrigin: 'center center',
          }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '100%',
              cursor: annotationMode ? 'crosshair' : (textLines.length > 0 ? 'pointer' : 'default'),
              imageRendering: 'high-quality',
              WebkitImageRendering: 'crisp-edges',
              msInterpolationMode: 'bicubic',
              boxShadow: '0 4px 10px -1px rgba(0, 0, 0, 0.15)',
            }}
          />
        </div>
        
        {/* Zoom indicator */}
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
          {Math.round(zoomLevel * 100)}%
        </div>
      </div>
    </div>
  );
}
