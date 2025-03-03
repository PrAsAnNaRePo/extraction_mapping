'use client';

import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import PDFViewer from '../components/PDFViewer';
import PageTabs from '../components/PageTabs';
import ImageAnnotator from '../components/ImageAnnotator';
import TextSidebar from '../components/TextSidebar';
import { PDFProcessingState, PDFInfo, PDFProcessingResult, OCRResult } from '../types/pdf';

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
                error: undefined
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
            const formData = new FormData();
            formData.append('file', pdfInfo.file_blob);
            formData.append('page_selection', selection);

            const response = await axios.post<PDFProcessingResult>(
                `${API_BASE_URL}/process-pdf`,
                formData
            );

            const results: Record<number, OCRResult[]> = {};
            response.data.processed_pages.forEach(page => {
                results[page.page] = page.ocr_data;
            });

            const processedPages = response.data.processed_pages.map(p => p.page);
            
            setProcessingState(prev => ({
                ...prev,
                isProcessing: false,
                currentPage: processedPages[0] || 0,
                processedPages,
                results,
            }));

            // Fetch images for all processed pages
            for (const page of processedPages) {
                await fetchPageImage(page);
            }
        } catch (error: any) {
            console.error('Error processing PDF:', error);
            let errorMessage = 'Failed to process PDF. Please try again.';
            
            if (error.response) {
                // Server responded with error
                errorMessage = error.response.data.detail || errorMessage;
            } else if (error.request) {
                // Request made but no response
                errorMessage = 'Could not connect to server. Please check your connection.';
            }
            
            setProcessingState(prev => ({
                ...prev,
                isProcessing: false,
                error: errorMessage
            }));
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
                                    selectedBox: undefined
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

                            {/* Text Results - Right Side */}
                            <div className="w-1/3 bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                                <TextSidebar
                                    ocrResults={processingState.results[processingState.currentPage] || []}
                                    onTextClick={handleBoxClick}
                                    onTextEdit={handleTextEdit}
                                    selectedText={processingState.selectedBox}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}