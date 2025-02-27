export interface PDFInfo {
    total_pages: number;
    file_name: string;
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

export interface TableBBox {
    class_id: number;
    xyxy: [number, number, number, number];
    xywh: [number, number, number, number];
}

export interface TableData {
    bbox_data: TableBBox[];
    html: string[];
}

export interface PageResult {
    page: number;
    ocr_data: OCRResult[];
    tables: TableData;
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
    tables: Record<number, TableData>;
    pageImages: Record<number, string>;  // base64 encoded images
    selectedBox?: OCRTextLine;
    selectedTable?: TableBBox;
    showTables: boolean;  // Toggle between text and table view
    error?: string;
}