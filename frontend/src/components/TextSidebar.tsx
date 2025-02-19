import { useEffect, useRef } from 'react';
import { TextLine } from '@/types/ocr';

interface TextSidebarProps {
  textLines: TextLine[];
  onTextClick: (textLine: TextLine) => void;
  selectedText?: TextLine;
}

export default function TextSidebar({ textLines, onTextClick, selectedText }: TextSidebarProps) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

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
              onClick={() => onTextClick(line)}
            >
              <p className="font-medium">{line.text}</p>
              <p className="text-sm text-gray-500">
                Confidence: {(line.confidence * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}