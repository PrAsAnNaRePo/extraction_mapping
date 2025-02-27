'use client';

import { useState } from 'react';
import axios from 'axios';
import PDFViewer from '../components/PDFViewer';
import PageTabs from '../components/PageTabs';
import ImageAnnotator from '../components/ImageAnnotator';
import TextSidebar from '../components/TextSidebar';
import TableViewer from '../components/TableViewer';
import { PDFProcessingState, PDFInfo, PDFProcessingResult, OCRResult, TableData, TableBBox, OCRTextLine } from '../types/pdf';

const API_BASE_URL = 'http://localhost:3002';

export default function Home() {
    const [pdfInfo, setPdfInfo] = useState<PDFInfo>();
    const [processingState, setProcessingState] = useState<PDFProcessingState>({
        isProcessing: false,
        currentPage: 0,
        processedPages: [],
        results: {},
        tables: {},
        pageImages: {} as Record<number, string>,
        selectedBox: undefined,
        selectedTable: undefined,
        showTables: true,
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
                tables: {},
                pageImages: {},
                selectedBox: undefined,
                selectedTable: undefined,
                showTables: true,
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
            formData.append('file', new File([pdfInfo.file_blob], pdfInfo.file_name));
            formData.append('page_selection', selection);

            const response = await axios.post<PDFProcessingResult>(
                `${API_BASE_URL}/process-pdf`,
                formData
            );

            const results: Record<number, OCRResult[]> = {};
            const tables: Record<number, TableData> = {};
            
            // Utility function to normalize table data
            const normalizeTableData = (tableData: any): TableData => {
                // Default empty values
                const normalized: TableData = { 
                    bbox_data: [], 
                    html: [] 
                };
                
                if (!tableData) return normalized;
                
                // Handle bbox_data
                if (Array.isArray(tableData.bbox_data)) {
                    normalized.bbox_data = tableData.bbox_data;
                }
                
                // Handle html content
                if (Array.isArray(tableData.html)) {
                    normalized.html = tableData.html;
                    
                    // Log table HTML for debugging
                    console.log(`Found ${normalized.html.length} table HTML fragments.`);
                    normalized.html.forEach((html, i) => {
                        if (html) {
                            console.log(`Table ${i+1} HTML (first 50 chars): ${html.substring(0, 50)}...`);
                        } else {
                            console.log(`Table ${i+1} HTML is empty or null`);
                        }
                    });
                }
                
                return normalized;
            };
            
            response.data.processed_pages.forEach(page => {
                results[page.page] = page.ocr_data;
                tables[page.page] = normalizeTableData(page.tables);
                
                // Debug logging to check what's coming from the backend
                console.log("Page tables data:", page.page, page.tables);
                console.log("Normalized table data:", tables[page.page]);
            });

            const processedPages = response.data.processed_pages.map(p => p.page);
            
            setProcessingState(prev => ({
                ...prev,
                isProcessing: false,
                currentPage: processedPages[0] || 0,
                processedPages,
                results,
                tables,
            }));

            // Fetch images for all processed pages
            for (const page of processedPages) {
                await fetchPageImage(page);
            }
        } catch (error) {
            console.error('Error processing PDF:', error);
            setProcessingState(prev => ({
                ...prev,
                isProcessing: false,
                error: 'Failed to process PDF. Please try again.'
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
        } catch (error) {
            console.error('Error fetching page image:', error);
        }
    };

    const handlePageChange = async (page: number) => {
        setProcessingState(prev => ({
            ...prev,
            currentPage: page,
            selectedBox: undefined, // Clear selection when changing pages
            selectedTable: undefined, // Clear table selection when changing pages
        }));

        // Fetch page image if not already cached
        if (!processingState.pageImages[page]) {
            await fetchPageImage(page);
        }
    };

    const handleBoxClick = (textLine: OCRTextLine) => {
        setProcessingState(prev => ({
            ...prev,
            selectedBox: textLine,
            selectedTable: undefined // Clear table selection when text is selected
        }));
    };
    
    const handleTableClick = (tableBox: TableBBox) => {
        setProcessingState(prev => ({
            ...prev,
            selectedTable: tableBox,
            selectedBox: undefined // Clear text selection when table is selected
        }));
    };
    
    const toggleViewMode = () => {
        setProcessingState(prev => ({
            ...prev,
            showTables: !prev.showTables,
            selectedBox: undefined,
            selectedTable: undefined
        }));
    };

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                    Engineering Drawing Text Extraction
                </h1>

                {/* PDF Upload and Page Selection */}
                <PDFViewer
                    onPDFSelect={handlePDFSelect}
                    onPageSelect={handlePageSelect}
                    processingState={processingState}
                    pdfInfo={pdfInfo}
                />

                {/* Content Area */}
                {processingState.processedPages.length > 0 && (
                    <div className="mt-8 space-y-4">
                        {/* Page Tabs */}
                        <PageTabs
                            pages={processingState.processedPages}
                            currentPage={processingState.currentPage}
                            onPageChange={handlePageChange}
                        />

                        {/* View Toggle Switch */}
                        <div className="flex justify-end mb-4">
                            <div className="inline-flex rounded-md shadow-sm">
                                <button
                                    onClick={toggleViewMode}
                                    className={`px-4 py-2 text-sm font-medium ${!processingState.showTables ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} rounded-l-md border border-gray-300`}
                                >
                                    Text
                                </button>
                                <button
                                    onClick={toggleViewMode}
                                    className={`px-4 py-2 text-sm font-medium ${processingState.showTables ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} rounded-r-md border-t border-r border-b border-gray-300`}
                                >
                                    Tables
                                </button>
                            </div>
                        </div>
                        
                        {/* Main Content */}
                        <div className="flex gap-4 h-[calc(100vh-400px)] min-h-[500px]">
                            {/* PDF Preview with Annotations */}
                            <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden">
                                {processingState.currentPage > 0 ? (
                                    <ImageAnnotator
                                        pageImage={processingState.pageImages[processingState.currentPage]}
                                        ocrResults={processingState.results[processingState.currentPage] || []}
                                        onBoxClick={handleBoxClick}
                                        selectedBox={processingState.selectedBox}
                                        tableData={processingState.tables[processingState.currentPage]?.bbox_data || []}
                                        onTableClick={handleTableClick}
                                        selectedTable={processingState.selectedTable}
                                        showTables={processingState.showTables}
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
                                            <span>Select pages to process</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Sidebar - Show either Text or Tables based on mode */}
                            <div className="w-96 bg-white rounded-lg shadow-sm overflow-hidden">
                                {processingState.showTables ? (
                                    <TableViewer
                                        tableData={processingState.tables[processingState.currentPage] || { bbox_data: [], html: [] }}
                                        onTableClick={handleTableClick}
                                        selectedTable={processingState.selectedTable}
                                    />
                                ) : (
                                    <TextSidebar
                                        ocrResults={processingState.results[processingState.currentPage] || []}
                                        onTextClick={handleBoxClick}
                                        selectedText={processingState.selectedBox}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}