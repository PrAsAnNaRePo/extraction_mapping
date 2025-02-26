export interface PDFInfo {
    total_pages: number;
    file_name: string;
    file_blob?: File; // Added to store the file for later use
}

export interface OCRTextLine {
    text: string;
    confidence: number;
    bbox: [number, number, number, number];
    polygon: [number, number][];
}

export interface OCRResult {
    text_lines: OCRTextLine[];
    languages: string[];
    image_bbox: [number, number, number, number];
}

export interface PageResult {
    page: number;
    ocr_data: OCRResult[];
}

export interface PDFProcessingResult {
    total_pages: number;
    processed_pages: PageResult[];
}

export interface PDFProcessingState {
    isProcessing: boolean;
    currentPage: number;
    processedPages: number[];
    results: Record<number, OCRResult[]>;
    pageImages: Record<number, string>;  // base64 encoded images
    selectedBox?: OCRTextLine;
    error?: string;
}