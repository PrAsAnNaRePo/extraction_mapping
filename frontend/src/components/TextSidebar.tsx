import { useEffect, useRef } from 'react';
import { OCRResult, OCRTextLine } from '@/types/pdf';

interface TextSidebarProps {
  ocrResults: OCRResult[];
  onTextClick?: (textLine: OCRTextLine) => void;
  selectedText?: OCRTextLine;
}

export default function TextSidebar({ ocrResults, onTextClick, selectedText }: TextSidebarProps) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Flatten all text lines from all OCR results
  const textLines = ocrResults.flatMap(result => result.text_lines);

  // Auto-scroll to selected text
  useEffect(() => {
    if (selectedText) {
      const index = textLines.findIndex(line => line === selectedText);
      if (index !== -1 && itemRefs.current[index]) {
        itemRefs.current[index]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedText, textLines]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      <div className="p-4 border-b bg-white">
        <h2 className="text-xl font-bold">Extracted Text</h2>
        <p className="text-sm text-gray-500 mt-1">
          {textLines.length} text lines found
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {textLines.map((line, i) => (
            <div
              key={i}
              ref={el => itemRefs.current[i] = el}
              className={`p-3 rounded cursor-pointer transition-colors ${
                selectedText === line
                  ? 'bg-blue-100 border-blue-500'
                  : 'bg-white hover:bg-gray-100 border-gray-200'
              } border`}
              onClick={() => onTextClick?.(line)}
            >
              <p className="font-medium break-words">{line.text}</p>
              <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                <span>Confidence: {(line.confidence * 100).toFixed(1)}%</span>
                <span className="text-xs">
                  {line.bbox[0].toFixed(0)}, {line.bbox[1].toFixed(0)}
                </span>
              </div>
            </div>
          ))}
          
          {textLines.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No text found in this page
            </div>
          )}
        </div>
      </div>
    </div>
  );
}