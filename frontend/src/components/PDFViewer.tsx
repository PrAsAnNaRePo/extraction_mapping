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
        <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto p-4 bg-white rounded-lg shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Document Upload</h2>
            
            {/* File Upload Area */}
            <div
                className={`
                    border-2 border-dashed rounded-lg p-6 text-center
                    transition-all duration-300 ease-in-out
                    ${isDragging ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-300'}
                    ${!pdfInfo ? 'cursor-pointer hover:border-blue-400 hover:shadow-sm' : 'bg-gray-50'}
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
                        <label htmlFor="pdf-upload" className="cursor-pointer block w-full h-full">
                            <div className="text-gray-500">
                                <svg className="mx-auto h-16 w-16 mb-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-xl font-medium text-gray-700">Drop your PDF here or click to upload</p>
                                <p className="text-sm mt-2 text-gray-500">Engineering drawings, schematics, and technical documents</p>
                            </div>
                        </label>
                    </>
                ) : (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <svg className="h-10 w-10 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">
                                    {pdfInfo.file_name}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {pdfInfo.total_pages} {pdfInfo.total_pages === 1 ? 'page' : 'pages'} • PDF Document
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="text-sm text-blue-500 hover:text-blue-700"
                        >
                            Change file
                        </button>
                    </div>
                )}
            </div>

            {/* Page Selection */}
            {pdfInfo && (
                <div className="space-y-4 mt-2">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="page-selection" className="text-sm font-medium text-gray-700 flex items-center">
                            <svg className="h-5 w-5 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Select Pages to Process
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                id="page-selection"
                                value={pageSelection}
                                onChange={(e) => setPageSelection(e.target.value)}
                                placeholder="e.g., 1-3, 5, 7-9 or 'all'"
                                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3"
                                disabled={processingState.isProcessing}
                            />
                            <button
                                onClick={handleProcess}
                                disabled={!pageSelection || processingState.isProcessing}
                                className={`
                                    px-6 py-2 rounded-md text-white font-medium flex items-center
                                    ${!pageSelection || processingState.isProcessing
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-500 hover:bg-blue-600 shadow-sm hover:shadow'}
                                    transition-all duration-200
                                `}
                            >
                                {processingState.isProcessing ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Process Pages
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 flex items-center">
                            <svg className="h-4 w-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Format: Page ranges (1-3), individual pages (5), or 'all'
                        </p>
                    </div>

                    {/* Processing Status */}
                    {processingState.isProcessing && (
                        <div className="bg-blue-50 text-blue-700 p-4 rounded-md border border-blue-100 animate-pulse">
                            <div className="flex items-center">
                                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <div>
                                    <p className="font-medium">Processing your PDF...</p>
                                    <p className="text-sm">This may take a few moments depending on document size</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {processingState.error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-100">
                            <div className="flex items-start">
                                <svg className="h-5 w-5 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <p className="font-medium">Error Processing Document</p>
                                    <p className="text-sm mt-1">{processingState.error}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PDFViewer;