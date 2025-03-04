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
    editedText?: string; // Optional field for storing edited text
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

export enum AnnotationType {
    TEXT = 'text',
    TABLE = 'table',
    DIAGRAM = 'diagram'
}

export interface Annotation {
    id: string;
    type: AnnotationType;
    bbox: [number, number, number, number];
    processed: boolean;
    result?: any; // Extracted content after processing
    hasError?: boolean; // Indicates if there was an error during processing
    isSelected?: boolean; // Whether this annotation is currently selected
    isAdjusting?: boolean; // Whether this annotation is being adjusted/resized
}

export interface PDFProcessingState {
    isProcessing: boolean;
    currentPage: number;
    processedPages: number[];
    results: Record<number, OCRResult[]>;
    pageImages: Record<number, string>;  // base64 encoded images
    selectedBox?: OCRTextLine;
    error?: string;
    annotationMode: boolean;
    annotations: Record<number, Annotation[]>; // Annotations by page number
    currentAnnotationType: AnnotationType;
    isDrawing: boolean;
    selectedAnnotationId?: string; // ID of selected annotation for editing
}