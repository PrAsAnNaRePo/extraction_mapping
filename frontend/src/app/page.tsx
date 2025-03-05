'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import PDFViewer from '../components/PDFViewer';
import PageTabs from '../components/PageTabs';
import ImageAnnotator from '../components/ImageAnnotator';
import TextSidebar from '../components/TextSidebar';
import ContentTabs from '../components/ContentTabs';
import { PDFProcessingState, PDFInfo, PDFProcessingResult, OCRResult, Annotation, AnnotationType, OCRTextLine } from '../types/pdf';

const API_BASE_URL = 'http://localhost:3002'; // Backend server URL

// Function to save edited text to the backend
const saveEditedText = async (page: number, textLines: OCRTextLine[]) => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/save-edited-text`,
            {
                page,
                text_lines: textLines.map(line => ({
                    text: line.text,
                    edited_text: line.editedText,
                    confidence: line.confidence,
                    bbox: line.bbox,
                    polygon: line.polygon
                }))
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error saving edited text:', error);
        throw error;
    }
};

export default function Home() {
    const [pdfInfo, setPdfInfo] = useState<PDFInfo>();
    const [processingState, setProcessingState] = useState<PDFProcessingState>({
        isProcessing: false,
        currentPage: 0,
        processedPages: [],
        results: {},
        pageImages: {} as Record<number, string>,
        selectedBox: undefined,
        annotationMode: false,
        annotations: {},
        currentAnnotationType: AnnotationType.TEXT,
        isDrawing: false,
        pageRotations: {} as Record<number, number>,
    });

    const handlePDFSelect = async (file: File) => {
        try {
            const formData = new FormData();
            formData.append('file', file);

            // Configure axios request
            const config = {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            };

            const response = await axios.post(
                `${API_BASE_URL}/pdf-info`,
                formData,
                config
            );
            
            setPdfInfo({
                ...response.data,
                file_blob: file // Store the file for later use
            });
            
            // Reset processing state
            setProcessingState({
                isProcessing: false,
                currentPage: 0,
                processedPages: [],
                results: {},
                pageImages: {},
                selectedBox: undefined,
                error: undefined,
                annotationMode: false,
                annotations: {},
                currentAnnotationType: AnnotationType.TEXT,
                isDrawing: false,
                pageRotations: {}
            });
        } catch (error: any) {
            console.error('Error getting PDF info:', error);
            let errorMessage = 'Failed to load PDF file. Please try again.';
            
            if (error.response) {
                // Server responded with error
                errorMessage = error.response.data.detail || errorMessage;
            } else if (error.request) {
                // Request made but no response
                errorMessage = 'Could not connect to server. Please check your connection.';
            }
            
            setProcessingState(prev => ({
                ...prev,
                error: errorMessage
            }));
        }
    };

    const handlePageSelect = async (selection: string) => {
        if (!pdfInfo) return;

        setProcessingState(prev => ({
            ...prev,
            isProcessing: true,
            error: undefined,
        }));

        try {
            // Get total pages from PDF info
            const total_pages = pdfInfo.total_pages;
            
            // Parse page selection
            let selected_pages: number[] = [];
            if (selection.toLowerCase() === "all") {
                selected_pages = Array.from({length: total_pages}, (_, i) => i + 1);
            } else {
                // Handle page ranges and individual pages
                const parts = selection.split(",");
                for (const part of parts) {
                    if (part.includes("-")) {
                        const [start, end] = part.split("-").map(p => parseInt(p.trim()));
                        for (let i = start; i <= end; i++) {
                            if (i > 0 && i <= total_pages) {
                                selected_pages.push(i);
                            }
                        }
                    } else {
                        const page = parseInt(part.trim());
                        if (page > 0 && page <= total_pages) {
                            selected_pages.push(page);
                        }
                    }
                }
            }
            
            // Remove duplicates and sort
            selected_pages = [...new Set(selected_pages)].sort((a, b) => a - b);
            
            if (selected_pages.length === 0) {
                throw new Error("No valid pages selected");
            }
            
            setProcessingState(prev => ({
                ...prev,
                isProcessing: false,
                currentPage: selected_pages[0] || 0,
                processedPages: selected_pages,
                annotationMode: true, // Start in annotation mode
            }));

            // Fetch images for all processed pages
            for (const page of selected_pages) {
                await fetchPageImage(page);
            }
            
            toast.success(`${selected_pages.length} pages ready for annotation`);
        } catch (error: any) {
            console.error('Error processing PDF:', error);
            let errorMessage = 'Failed to process PDF. Please try again.';
            
            if (error.response) {
                // Server responded with error
                errorMessage = error.response.data.detail || errorMessage;
            } else if (error.request) {
                // Request made but no response
                errorMessage = 'Could not connect to server. Please check your connection.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setProcessingState(prev => ({
                ...prev,
                isProcessing: false,
                error: errorMessage
            }));
            
            toast.error(errorMessage);
        }
    };

    const fetchPageImage = async (page: number) => {
        if (!pdfInfo?.file_blob) return;

        try {
            const formData = new FormData();
            formData.append('file', pdfInfo.file_blob);
            formData.append('page', page.toString());

            const response = await axios.post(
                `${API_BASE_URL}/get-page-image`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            setProcessingState(prev => ({
                ...prev,
                pageImages: {
                    ...prev.pageImages,
                    [page]: response.data.image
                }
            }));
        } catch (error: any) {
            console.error('Error fetching page image:', error);
            let errorMessage = 'Failed to fetch page image.';
            
            if (error.response) {
                errorMessage = error.response.data.detail || errorMessage;
            }
            
            setProcessingState(prev => ({
                ...prev,
                error: errorMessage
            }));
        }
    };

    const handlePageChange = async (page: number) => {
        setProcessingState(prev => ({
            ...prev,
            currentPage: page,
            selectedBox: undefined, // Clear selection when changing pages
            selectedAnnotationId: undefined, // Clear selected annotation
            // Use the stored rotation for this page, or default to 0
            rotation: prev.pageRotations?.[page] || 0
        }));

        // Fetch page image if not already cached
        if (!processingState.pageImages[page]) {
            await fetchPageImage(page);
        }
    };

    const handleBoxClick = (textLine: OCRTextLine) => {
        setProcessingState(prev => ({
            ...prev,
            selectedBox: textLine
        }));
    };
    
    const handlePageRotation = (rotation: number) => {
        // Update the rotation for the current page
        setProcessingState(prev => {
            const updatedRotations = {
                ...(prev.pageRotations || {}),
                [prev.currentPage]: rotation
            };
            
            return {
                ...prev,
                pageRotations: updatedRotations
            };
        });
    };
    
    const handleTextEdit = async (textLine: OCRTextLine, newText: string) => {
        // Special case for saving all edits
        if (newText === '___SAVE_ALL_TEXTS___') {
            try {
                // Get all text lines for the current page
                const textLinesToSave = processingState.results[processingState.currentPage]?.flatMap(result => result.text_lines) || [];
                
                // Save to the backend
                const result = await saveEditedText(processingState.currentPage, textLinesToSave);
                
                // Show success message
                toast.success('All text changes saved successfully!');
            } catch (error: any) {
                toast.error(`Failed to save: ${error.message || 'Unknown error'}`);
            }
            return;
        }
        
        // Regular text edit case - use a functional update to ensure we're working with latest state
        setProcessingState(prevState => {
            // Create a deep copy of the current results
            const updatedResults = JSON.parse(JSON.stringify(prevState.results));
            
            // Find and update the specific text line
            if (prevState.currentPage in updatedResults) {
                updatedResults[prevState.currentPage] = updatedResults[prevState.currentPage].map((result: any) => {
                    return {
                        ...result,
                        text_lines: result.text_lines.map((line: OCRTextLine) => {
                            // Check if this is the line we want to update (using bbox to compare)
                            if (line.bbox.toString() === textLine.bbox.toString()) {
                                return {
                                    ...line,
                                    editedText: newText
                                };
                            }
                            return line;
                        })
                    };
                });
                
                // Create updated selectedBox with the new text
                const updatedSelectedBox = {
                    ...textLine,
                    editedText: newText
                };
                
                // Return the new state
                return {
                    ...prevState,
                    results: updatedResults,
                    selectedBox: updatedSelectedBox
                };
            }
            
            // If we can't find the page, return state unchanged
            return prevState;
        });
    };
    
    // Annotation related handlers
    const handleAnnotationModeToggle = () => {
        setProcessingState(prev => ({
            ...prev,
            annotationMode: !prev.annotationMode,
            // Ensure rotation is preserved when toggling annotation mode
            rotation: prev.pageRotations?.[prev.currentPage] || 0
        }));
    };

    const handleAnnotationTypeChange = (type: AnnotationType) => {
        setProcessingState(prev => ({
            ...prev,
            currentAnnotationType: type
        }));
    };

    const handleCreateAnnotation = (annotationData: Omit<Annotation, 'id'>) => {
        const id = uuidv4();
        const annotation: Annotation = {
            ...annotationData,
            id
        };

        setProcessingState(prev => {
            // Get current annotations for this page or initialize empty array
            const pageAnnotations = prev.annotations[prev.currentPage] || [];
            
            return {
                ...prev,
                annotations: {
                    ...prev.annotations,
                    [prev.currentPage]: [...pageAnnotations, annotation]
                }
            };
        });

        // Show success toast
        toast.success(`${annotationData.type} annotation created`);
    };
    
    const handleUpdateAnnotation = (id: string, bbox: [number, number, number, number]) => {
        setProcessingState(prev => {
            // Get current annotations for this page
            const pageAnnotations = prev.annotations[prev.currentPage] || [];
            
            // Find and update the specific annotation
            const updatedAnnotations = pageAnnotations.map(annotation => {
                if (annotation.id === id) {
                    return {
                        ...annotation,
                        bbox
                    };
                }
                return annotation;
            });
            
            return {
                ...prev,
                annotations: {
                    ...prev.annotations,
                    [prev.currentPage]: updatedAnnotations
                }
            };
        });
    };
    
    const handleDeleteAnnotation = (id: string) => {
        setProcessingState(prev => {
            // Get current annotations for this page
            const pageAnnotations = prev.annotations[prev.currentPage] || [];
            
            // Filter out the annotation to delete
            const updatedAnnotations = pageAnnotations.filter(annotation => annotation.id !== id);
            
            return {
                ...prev,
                annotations: {
                    ...prev.annotations,
                    [prev.currentPage]: updatedAnnotations
                }
            };
        });
        
        // Show success toast
        toast.success("Annotation deleted");
    };
    
    const handleSelectAnnotation = (id: string) => {
        setProcessingState(prev => ({
            ...prev,
            selectedAnnotationId: id
        }));
    };

    const handleDetectTables = async () => {
        if (!pdfInfo?.file_blob || processingState.currentPage === 0) return;

        try {
            setProcessingState(prev => ({
                ...prev,
                isProcessing: true
            }));

            const formData = new FormData();
            formData.append('file', pdfInfo.file_blob);
            formData.append('page', processingState.currentPage.toString());

            const response = await axios.post(
                `${API_BASE_URL}/detect-tables`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            // Add detected tables as annotations
            if (response.data.tables && response.data.tables.length > 0) {
                setProcessingState(prev => {
                    // Get current annotations for this page or initialize empty array
                    const pageAnnotations = prev.annotations[prev.currentPage] || [];
                    
                    // Convert detected tables to annotations
                    const tableAnnotations: Annotation[] = response.data.tables.map((table: any) => ({
                        id: table.id,
                        type: AnnotationType.TABLE,
                        bbox: table.bbox as [number, number, number, number],
                        processed: false
                    }));
                    
                    return {
                        ...prev,
                        isProcessing: false,
                        annotations: {
                            ...prev.annotations,
                            [prev.currentPage]: [...pageAnnotations, ...tableAnnotations]
                        }
                    };
                });

                toast.success(`${response.data.count} tables automatically detected`);
            } else {
                setProcessingState(prev => ({
                    ...prev,
                    isProcessing: false
                }));
                toast.info('No tables detected in this page');
            }
        } catch (error: any) {
            console.error('Error detecting tables:', error);
            setProcessingState(prev => ({
                ...prev,
                isProcessing: false
            }));
            
            let errorMessage = 'Failed to detect tables. Please try again.';
            if (error.response) {
                errorMessage = error.response.data.detail || errorMessage;
            }
            
            toast.error(errorMessage);
        }
    };

    const handleProcessAnnotations = async () => {
        const currentPageAnnotations = processingState.annotations[processingState.currentPage] || [];
        const unprocessedAnnotations = currentPageAnnotations.filter(annotation => !annotation.processed);
        
        if (unprocessedAnnotations.length === 0) {
            toast.info('No unprocessed annotations to process');
            return;
        }

        try {
            setProcessingState(prev => ({
                ...prev,
                isProcessing: true
            }));

            // Show a toast indicating the number of annotations being processed
            toast.loading(`Processing ${unprocessedAnnotations.length} annotations...`, {
                id: 'annotations-processing'
            });

            // Process each annotation in sequence
            for (const annotation of unprocessedAnnotations) {
                // Update toast to show current annotation
                toast.loading(`Processing ${annotation.type} annotation...`, {
                    id: 'annotations-processing'
                });
                
                try {
                    // Get the image data for this annotation by cropping from the page image
                    const croppedImageData = await getCroppedImageData(
                        processingState.pageImages[processingState.currentPage],
                        annotation.bbox
                    );

                    console.log(`Sending ${annotation.type} annotation with data length: ${croppedImageData.length}`);
                    
                    // For diagram types, let's provide a better fallback in case of API issues
                    const sendData = {
                        id: annotation.id,
                        type: annotation.type,
                        bbox: annotation.bbox.map(n => Math.round(n)), // Convert to integers
                        image_data: croppedImageData,
                        rotation: processingState.pageRotations?.[processingState.currentPage] || 0
                    };
                    
                    console.log(`Sending ${annotation.type} annotation to server...`);
                    
                    // Wrap request in try-catch to handle server errors gracefully
                    try {
                        const response = await axios.post(
                            `${API_BASE_URL}/process-annotation`,
                            sendData,
                            {
                                timeout: 120000, // 120s timeout for AI processing
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        
                        console.log(`Received response for ${annotation.type}:`, response.data);
                        
                        // Check if the response contains an error message - handle all types of response structures
                        let hasError = false;
                        let errorMessage = "";
                        
                        if (response.data.result) {
                            // Case 1: Direct error flag in the result
                            if (response.data.result.error === true) {
                                hasError = true;
                                errorMessage = response.data.result.message || "Unknown error";
                            }
                            // Case 2: Error message in the diag_description (diagrams)
                            else if (response.data.result.diag_description && 
                                    typeof response.data.result.diag_description === 'string' &&
                                    response.data.result.diag_description.toLowerCase().includes('error')) {
                                hasError = true;
                                errorMessage = response.data.result.diag_description;
                            }
                            // Case 3: Error in the text field (for text annotations)
                            else if (Array.isArray(response.data.result) && 
                                    response.data.result[0] && 
                                    response.data.result[0].text_lines && 
                                    response.data.result[0].text_lines[0] &&
                                    response.data.result[0].text_lines[0].text &&
                                    response.data.result[0].text_lines[0].text.includes('Error')) {
                                hasError = true;
                                errorMessage = response.data.result[0].text_lines[0].text;
                            }
                        }
                        
                        // Update the annotation with the result (even if there was an error)
                        setProcessingState(prev => {
                            const pageAnnotations = [...(prev.annotations[prev.currentPage] || [])];
                            
                            // Find and update the processed annotation
                            const index = pageAnnotations.findIndex(a => a.id === annotation.id);
                            if (index !== -1) {
                                pageAnnotations[index] = {
                                    ...pageAnnotations[index],
                                    processed: true,
                                    result: response.data.result,
                                    hasError: hasError
                                };
                            }
                            
                            return {
                                ...prev,
                                annotations: {
                                    ...prev.annotations,
                                    [prev.currentPage]: pageAnnotations
                                }
                            };
                        });
                        
                        if (hasError) {
                            // Show error toast but consider the processing complete
                            console.warn(`Error detected in ${annotation.type} annotation:`, errorMessage);
                            toast.error(`Issue with ${annotation.type} annotation: ${errorMessage}`, {
                                duration: 4000
                            });
                        } else {
                            // Show success toast
                            toast.success(`Processed ${annotation.type} annotation successfully`, {
                                duration: 2000
                            });
                        }
                    } catch (apiError) {
                        // Handle API errors gracefully with a fallback response
                        console.error(`API error processing ${annotation.type} annotation:`, apiError);
                        
                        // Create fallback result based on annotation type
                        let fallbackResult = null;
                        
                        if (annotation.type === 'diagram') {
                            fallbackResult = {
                                diag_heading: "Diagram Annotation",
                                diag_description: "Unable to process diagram due to server error.",
                                annotations: [
                                    {marking: "Error", description: "Server error occurred during processing"}
                                ]
                            };
                        } else if (annotation.type === 'text') {
                            fallbackResult = [{
                                text_lines: [{
                                    text: "Unable to process text due to server error.",
                                    confidence: 1.0,
                                    bbox: annotation.bbox,
                                    polygon: [[annotation.bbox[0], annotation.bbox[1]], 
                                            [annotation.bbox[2], annotation.bbox[1]],
                                            [annotation.bbox[2], annotation.bbox[3]], 
                                            [annotation.bbox[0], annotation.bbox[3]]]
                                }],
                                languages: ["en"],
                                image_bbox: [0, 0, 1000, 1000]
                            }];
                        } else {
                            fallbackResult = ["<table><tr><td>Error processing table</td></tr></table>"];
                        }
                        
                        // Update state with fallback result
                        setProcessingState(prev => {
                            const pageAnnotations = [...(prev.annotations[prev.currentPage] || [])];
                            const index = pageAnnotations.findIndex(a => a.id === annotation.id);
                            if (index !== -1) {
                                pageAnnotations[index] = {
                                    ...pageAnnotations[index],
                                    processed: true,
                                    result: fallbackResult,
                                    hasError: true
                                };
                            }
                            return {
                                ...prev,
                                annotations: {
                                    ...prev.annotations,
                                    [prev.currentPage]: pageAnnotations
                                }
                            };
                        });
                        
                        toast.error(`Server error processing ${annotation.type} annotation`, {
                            duration: 4000
                        });
                    }
                } catch (annotationError: any) {
                    console.error(`Error processing ${annotation.type} annotation:`, annotationError);
                    
                    let errorMessage = `Failed to process ${annotation.type} annotation`;
                    if (annotationError.response) {
                        // Server returned an error response
                        if (annotationError.response.status === 422) {
                            errorMessage = `Data validation error for ${annotation.type} annotation. Check server logs.`;
                        } else {
                            errorMessage = annotationError.response.data?.detail || errorMessage;
                        }
                    } else if (annotationError.request) {
                        // Request was made but no response received (timeout, etc.)
                        errorMessage = `No response received while processing ${annotation.type} annotation. Server may be busy.`;
                    } else {
                        // Error in setting up the request
                        errorMessage = annotationError.message || 'Unknown error';
                    }
                    
                    toast.error(errorMessage);
                    
                    // Mark as processed with error to avoid repeated attempts
                    setProcessingState(prev => {
                        const pageAnnotations = [...(prev.annotations[prev.currentPage] || [])];
                        const index = pageAnnotations.findIndex(a => a.id === annotation.id);
                        if (index !== -1) {
                            pageAnnotations[index] = {
                                ...pageAnnotations[index],
                                processed: true,
                                result: { error: errorMessage },
                                hasError: true
                            };
                        }
                        return {
                            ...prev,
                            annotations: {
                                ...prev.annotations,
                                [prev.currentPage]: pageAnnotations
                            }
                        };
                    });
                }
            }

            setProcessingState(prev => ({
                ...prev,
                isProcessing: false
            }));
            
            // Dismiss the loading toast
            toast.dismiss('annotations-processing');
            toast.success('All annotations processed');
        } catch (error: any) {
            console.error('Error processing annotations:', error);
            setProcessingState(prev => ({
                ...prev,
                isProcessing: false
            }));
            
            // Dismiss the loading toast
            toast.dismiss('annotations-processing');
            
            let errorMessage = 'Failed to process annotations. Please try again.';
            if (error.response) {
                errorMessage = error.response.data.detail || errorMessage;
            }
            
            toast.error(errorMessage);
        }
    };

    // Helper function to crop an image based on bbox coordinates
    const getCroppedImageData = (imageUrl: string, bbox: [number, number, number, number]): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            // Since we're working with base64 data URLs from our own backend, 
            // we don't need crossOrigin but we'll keep it for future-proofing
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    // Calculate the crop dimensions
                    const [x1, y1, x2, y2] = bbox;
                    const width = x2 - x1;
                    const height = y2 - y1;
                    
                    // Get the current page rotation (0, 90, 180, 270)
                    const currentRotation = processingState.pageRotations?.[processingState.currentPage] || 0;

                    // Set canvas dimensions based on rotation
                    if (currentRotation === 90 || currentRotation === 270) {
                        // Swap width and height for 90 or 270 degree rotations
                        canvas.width = height;
                        canvas.height = width;
                    } else {
                        canvas.width = width;
                        canvas.height = height;
                    }

                    // Apply rotation transformation
                    ctx.save();
                    
                    if (currentRotation !== 0) {
                        // Translate to center of canvas
                        ctx.translate(canvas.width/2, canvas.height/2);
                        
                        // Rotate canvas
                        ctx.rotate((currentRotation * Math.PI) / 180);
                        
                        // Draw based on rotation
                        if (currentRotation === 90) {
                            ctx.drawImage(img, x1, y1, width, height, -height/2, -width/2, height, width);
                        } else if (currentRotation === 180) {
                            ctx.drawImage(img, x1, y1, width, height, -width/2, -height/2, width, height);
                        } else if (currentRotation === 270) {
                            ctx.drawImage(img, x1, y1, width, height, -height/2, -width/2, height, width);
                        }
                    } else {
                        // No rotation, draw normally
                        ctx.drawImage(img, x1, y1, width, height, 0, 0, width, height);
                    }
                    
                    ctx.restore();
                    
                    try {
                        // Get the base64 data URL - this has the rotated image
                        const dataUrl = canvas.toDataURL('image/png');
                        resolve(dataUrl);
                    } catch (canvasError) {
                        // This happens when the canvas is tainted due to cross-origin issues
                        console.error('Canvas tainted by cross-origin data:', canvasError);
                        reject(new Error('Cannot extract image data due to cross-origin restrictions'));
                    }
                } catch (error) {
                    console.error('Error processing image in canvas:', error);
                    reject(error);
                }
            };
            
            img.onerror = (e) => {
                console.error('Image loading error:', e);
                reject(new Error('Failed to load image for cropping'));
            };
            
            // Add timeout to prevent hanging on image load
            setTimeout(() => {
                if (!img.complete) {
                    reject(new Error('Image loading timed out'));
                }
            }, 30000); // 30 second timeout
            
            img.src = imageUrl;
        });
    };

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
                    Feature Extraction
                </h1>

                {/* Show upload area only when no pages are processed */}
                {processingState.processedPages.length === 0 ? (
                    <div className="mb-6">
                        <PDFViewer
                            onPDFSelect={handlePDFSelect}
                            onPageSelect={handlePageSelect}
                            processingState={processingState}
                            pdfInfo={pdfInfo}
                        />
                    </div>
                ) : (
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-medium text-gray-700">
                                {pdfInfo?.file_name}
                            </h2>
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded">
                                {processingState.processedPages.length} pages processed
                            </span>
                        </div>
                        <button 
                            onClick={() => {
                                // Reset state to show upload form again
                                setProcessingState({
                                    isProcessing: false,
                                    currentPage: 0,
                                    processedPages: [],
                                    results: {},
                                    pageImages: {},
                                    selectedBox: undefined,
                                    annotationMode: false,
                                    annotations: {},
                                    currentAnnotationType: AnnotationType.TEXT,
                                    isDrawing: false
                                });
                                setPdfInfo(undefined);
                            }}
                            className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 bg-gray-50 rounded transition"
                        >
                            Upload New File
                        </button>
                    </div>
                )}

                {/* Content Area - Only shown when processing is complete */}
                {processingState.processedPages.length > 0 && (
                    <div className="space-y-3">
                        {/* Page Tabs */}
                        <PageTabs
                            pages={processingState.processedPages}
                            currentPage={processingState.currentPage}
                            onPageChange={handlePageChange}
                        />

                        {/* Main Content - Side-by-Side Layout - Full height */}
                        <div className="flex flex-row gap-4 h-[calc(90vh-150px)] min-h-[650px]">
                            {/* Image View - Left Side */}
                            <div className="w-2/3 bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                                {processingState.currentPage > 0 ? (
                                    <ImageAnnotator
                                        pageImage={processingState.pageImages[processingState.currentPage]}
                                        ocrResults={processingState.results[processingState.currentPage] || []}
                                        onBoxClick={handleBoxClick}
                                        selectedBox={processingState.selectedBox}
                                        
                                        // Annotation props
                                        annotationMode={processingState.annotationMode}
                                        currentAnnotationType={processingState.currentAnnotationType}
                                        annotations={processingState.annotations[processingState.currentPage] || []}
                                        onAnnotationModeToggle={handleAnnotationModeToggle}
                                        onAnnotationTypeChange={handleAnnotationTypeChange}
                                        onCreateAnnotation={handleCreateAnnotation}
                                        onUpdateAnnotation={handleUpdateAnnotation}
                                        onDeleteAnnotation={handleDeleteAnnotation}
                                        onSelectAnnotation={handleSelectAnnotation}
                                        onDetectTables={handleDetectTables}
                                        onProcessAnnotations={handleProcessAnnotations}
                                        
                                        // Rotation props
                                        rotation={processingState.pageRotations?.[processingState.currentPage] || 0}
                                        onRotationChange={handlePageRotation}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        {processingState.isProcessing ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span>Processing PDF...</span>
                                            </div>
                                        ) : (
                                            <span>Select a page from the tabs above</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Extracted Content - Right Side */}
                            <div className="w-1/3 bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                                <ContentTabs
                                    annotations={processingState.annotations[processingState.currentPage] || []}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}