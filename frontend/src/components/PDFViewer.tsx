import React, { useState, useCallback } from 'react';
import { PDFProcessingState, PDFInfo } from '../types/pdf';
import axios from 'axios';

interface PDFViewerProps {
    onPDFSelect: (file: File) => Promise<void>;
    onPageSelect: (selection: string) => Promise<void>;
    processingState: PDFProcessingState;
    pdfInfo?: PDFInfo;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
    onPDFSelect,
    onPageSelect,
    processingState,
    pdfInfo
}) => {
    const [pageSelection, setPageSelection] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type === 'application/pdf') {
                // Verify file size (optional, adjust limit as needed)
                if (file.size > 50 * 1024 * 1024) { // 50MB limit
                    alert('File size too large. Please select a PDF under 50MB.');
                    return;
                }
                await onPDFSelect(file);
                setPageSelection('');
            } else {
                alert('Please select a valid PDF file.');
            }
        }
    };

    const handleDrop = useCallback(async (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);

        const file = event.dataTransfer.files[0];
        if (file) {
            if (file.type === 'application/pdf') {
                // Verify file size
                if (file.size > 50 * 1024 * 1024) { // 50MB limit
                    alert('File size too large. Please select a PDF under 50MB.');
                    return;
                }
                await onPDFSelect(file);
                setPageSelection('');
            } else {
                alert('Please select a valid PDF file.');
            }
        }
    }, [onPDFSelect]);

    const handleDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleProcess = async () => {
        if (pageSelection) {
            await onPageSelect(pageSelection);
        }
    };

    return (
        <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto p-4">
            {/* File Upload Area */}
            <div
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center
                    transition-colors duration-200 ease-in-out
                    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                    ${!pdfInfo ? 'cursor-pointer hover:border-blue-400' : ''}
                `}
                onDrop={!pdfInfo ? handleDrop : undefined}
                onDragOver={!pdfInfo ? handleDragOver : undefined}
                onDragLeave={!pdfInfo ? handleDragLeave : undefined}
            >
                {!pdfInfo ? (
                    <>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="hidden"
                            id="pdf-upload"
                        />
                        <label htmlFor="pdf-upload" className="cursor-pointer">
                            <div className="text-gray-500">
                                <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-lg font-medium">Drop your PDF here or click to upload</p>
                                <p className="text-sm mt-2">Only PDF files are supported</p>
                            </div>
                        </label>
                    </>
                ) : (
                    <div className="text-left">
                        <h3 className="text-lg font-medium text-gray-900">
                            {pdfInfo.file_name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {pdfInfo.total_pages} pages
                        </p>
                    </div>
                )}
            </div>

            {/* Page Selection */}
            {pdfInfo && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="page-selection" className="text-sm font-medium text-gray-700">
                            Select Pages
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                id="page-selection"
                                value={pageSelection}
                                onChange={(e) => setPageSelection(e.target.value)}
                                placeholder="e.g., 1-3, 5, 7-9 or 'all'"
                                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                disabled={processingState.isProcessing}
                            />
                            <button
                                onClick={handleProcess}
                                disabled={!pageSelection || processingState.isProcessing}
                                className={`
                                    px-4 py-2 rounded-md text-white font-medium
                                    ${!pageSelection || processingState.isProcessing
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-500 hover:bg-blue-600'}
                                    transition-colors duration-200
                                `}
                            >
                                {processingState.isProcessing ? 'Processing...' : 'Process Pages'}
                            </button>
                        </div>
                        <p className="text-sm text-gray-500">
                            Format: Page ranges (1-3), individual pages (5), or 'all'
                        </p>
                    </div>

                    {/* Processing Status */}
                    {processingState.isProcessing && (
                        <div className="bg-blue-50 text-blue-700 p-4 rounded-md">
                            <div className="flex items-center">
                                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>Processing your PDF...</span>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {processingState.error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-md">
                            {processingState.error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PDFViewer;