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
      <div className="p-3 border-b bg-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Extracted Text</h2>
          <p className="text-sm text-gray-500">
            {textLines.length} text lines found
          </p>
        </div>
        {selectedText && (
          <div className="bg-blue-50 p-2 rounded-md border border-blue-200">
            <p className="font-medium text-blue-800">Selected: "{selectedText.text}"</p>
            <p className="text-xs text-blue-600">Confidence: {(selectedText.confidence * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {textLines.map((line, i) => (
            <div
              key={i}
              ref={el => itemRefs.current[i] = el}
              className={`p-2 rounded cursor-pointer transition-colors ${
                selectedText === line
                  ? 'bg-blue-100 border-blue-500'
                  : 'bg-white hover:bg-gray-100 border-gray-200'
              } border text-sm`}
              onClick={() => onTextClick?.(line)}
            >
              <p className="font-medium break-words">{line.text}</p>
              <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                <span>{(line.confidence * 100).toFixed(1)}%</span>
                <span>
                  {line.bbox[0].toFixed(0)}, {line.bbox[1].toFixed(0)}
                </span>
              </div>
            </div>
          ))}
          
          {textLines.length === 0 && (
            <div className="text-center py-4 text-gray-500 col-span-full">
              No text found in this page
            </div>
          )}
        </div>
      </div>
    </div>
  );
}