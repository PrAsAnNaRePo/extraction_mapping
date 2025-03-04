'use client';

import { useEffect, useRef, useState } from 'react';
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
  onProcessAnnotations
}: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [hoveredBox, setHoveredBox] = useState<OCRTextLine | null>(null);
  const [error, setError] = useState<string>();
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Annotation related states
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number, y: number } | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null); // 'tl', 'tr', 'bl', 'br', null
  const [initialBbox, setInitialBbox] = useState<[number, number, number, number] | null>(null);

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
      // Create a new image with higher quality settings
      const img = new Image();
      
      // Set crossOrigin to allow processing the image on canvas 
      img.crossOrigin = 'anonymous';
      
      // Set image loading attributes for better quality
      img.setAttribute('decoding', 'sync'); // Decode synchronously for better initial quality
      img.setAttribute('loading', 'eager'); // Load image eagerly
      
      // Handle successful load
      img.onload = () => {
        console.log(`Image loaded successfully: ${img.naturalWidth}x${img.naturalHeight}`);
        setImage(img);
        setError(undefined);
        
        // Reset scale to 1, it will be calculated properly in the render function
        setScale(1);
      };
      
      // Handle loading error
      img.onerror = () => {
        console.error('Failed to load image');
        setError('Failed to load image');
        setImage(null);
      };
      
      // Set source after attaching event handlers
      img.src = src;
    };

    if (pageImage) {
      // Check if we're dealing with a base64 image
      const isBase64 = typeof pageImage === 'string' && pageImage.startsWith('data:');
      console.log(`Loading page image. Is base64: ${isBase64}`);
      loadImage(pageImage);
    } else if (imageUrl) {
      console.log(`Loading image from URL: ${imageUrl}`);
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
    
    console.log(`Container dimensions: ${containerWidth}x${containerHeight}`);
    console.log(`Image dimensions: ${image.width}x${image.height}`);
    
    // For higher quality, we'll use more of the container but still leave some padding
    const maxWidth = containerWidth * 0.98;  // Use 98% of container width
    const maxHeight = containerHeight * 0.98; // Use 98% of container height
    
    // Calculate scaling factors with higher precision
    const scaleX = maxWidth / image.width;
    const scaleY = maxHeight / image.height;
    
    // Use the smaller scale to ensure image fits completely with proper aspect ratio
    const newScale = Math.min(scaleX, scaleY);
    
    // For very small images, increase the maximum scale to allow better resolution
    // Allow up to 4x enlargement for better quality on high-DPI displays
    const limitedScale = Math.min(newScale, 4.0);
    
    console.log(`Calculated scale: ${limitedScale.toFixed(2)}`);
    setScale(limitedScale);
    
    // Set canvas size based on the calculated scale to maintain aspect ratio
    canvas.width = image.width * newScale;
    canvas.height = image.height * newScale;
    
    // Track the actual canvas dimensions for calculating relative coordinates
    canvas.dataset.actualWidth = String(canvas.width);
    canvas.dataset.actualHeight = String(canvas.height);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply advanced image rendering improvements
    ctx.imageSmoothingEnabled = true;  // Enable image smoothing
    ctx.imageSmoothingQuality = "high"; // Use high quality smoothing
    
    // Clear any previous filters and set composite operation
    ctx.globalCompositeOperation = 'source-over';
    
    // Apply enhanced image processing with improved filters
    // Increase contrast, clarity and sharpen edges while maintaining natural colors
    ctx.filter = 'contrast(1.2) saturate(1.1) brightness(1.02)';
    
    // Draw image with high-quality settings
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    // Reset filter for other rendering operations
    ctx.filter = 'none';

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

    // Draw OCR text bounding boxes with correct scaling (if not in annotation mode)
    if (!annotationMode) {
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
    }

    // Draw user annotations
    if (annotations && annotations.length > 0) {
      annotations.forEach((annotation) => {
        const [x, y, x2, y2] = annotation.bbox;
        
        // Scale bbox coordinates to match the canvas dimensions
        const scaledX = x * xScaleFactor;
        const scaledY = y * yScaleFactor;
        const scaledWidth = (x2 - x) * xScaleFactor;
        const scaledHeight = (y2 - y) * yScaleFactor;

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
          ctx.beginPath();
          ctx.rect(scaledX + scaledWidth - deleteButtonSize - 5, scaledY + 5, deleteButtonSize, deleteButtonSize);
          ctx.fill();
          ctx.stroke();
          
          // Add an X to the delete button
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Arial';
          ctx.fillText('×', scaledX + scaledWidth - deleteButtonSize, scaledY + 17);
        }
      });
    }

    // Draw the current selection rectangle if the user is drawing
    if (isDrawing && startPoint && currentPoint) {
      // Get the drawing rectangle coordinates (ensuring we handle drawing in any direction)
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const width = Math.abs(currentPoint.x - startPoint.x);
      const height = Math.abs(currentPoint.y - startPoint.y);
      
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
      
      ctx.setLineDash([6, 3]); // Make a dashed line
      ctx.lineWidth = 2;
      
      // Draw the selection rectangle
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]); // Reset to solid line
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
    resizeHandle
  ]);

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
        const deleteButtonX = scaledX + scaledWidth - deleteButtonSize - 5;
        const deleteButtonY = scaledY + 5;
        
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
            
            <button 
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 5))}
              className="p-1 rounded hover:bg-gray-100 text-gray-700 ml-2"
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
          
          <div className="text-sm text-gray-600">
            {textLines.length} text elements detected
          </div>
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
        />
      )}
      
      {/* Canvas Container with Overflow */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto relative flex items-center justify-center bg-white"
        style={{
          backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%), linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px',
          borderRadius: '4px'
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
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
            cursor: annotationMode 
              ? isDrawing 
                ? 'crosshair' 
                : 'crosshair' 
              : textLines.length > 0 
                ? 'pointer' 
                : 'default',
            // Enhanced image quality improvements
            imageRendering: 'high-quality', // Modern browsers
            WebkitImageRendering: 'crisp-edges', // Safari
            msInterpolationMode: 'bicubic', // For IE
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            boxShadow: '0 4px 10px -1px rgba(0, 0, 0, 0.15)',
            backfaceVisibility: 'hidden', // Prevent flickering during transforms
          }}
        />
      </div>
    </div>
  );
}
