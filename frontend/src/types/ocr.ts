export interface TextLine {
  polygon: number[][];
  confidence: number;
  text: string;
  bbox: number[];
}

export interface OCRResult {
  text_lines: TextLine[];
  languages: string[];
  image_bbox: number[];
}

export interface OCRResponse {
  results: OCRResult[];
}