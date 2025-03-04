import { useEffect, useRef } from 'react';
import { OCRResult, OCRTextLine } from '@/types/pdf';

interface TextSidebarProps {
  ocrResults: OCRResult[];
  onTextClick?: (textLine: OCRTextLine) => void;
  selectedText?: OCRTextLine;
  onTextEdit?: (textLine: OCRTextLine, newText: string) => void;
}

const TextSidebar = ({ ocrResults, onTextClick, selectedText, onTextEdit }: TextSidebarProps) => {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const editInputRef = useRef<HTMLInputElement>(null);
  
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
      <div className="p-3 border-b bg-white">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-gray-800">Extracted Text</h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
            {textLines.length} items
          </span>
        </div>
        
        {/* Confidence level legend */}
        <div className="mt-2 mb-3 p-2 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-1.5">Confidence Level Legend:</p>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1">
            <div className="flex items-center text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
              <span className="text-green-800">High (65-100%)</span>
            </div>
            <div className="flex items-center text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
              <span className="text-blue-800">Moderate (40-64%)</span>
            </div>
            <div className="flex items-center text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span>
              <span className="text-red-800">Low (&lt;40%)</span>
            </div>
          </div>
        </div>
        
        {selectedText && (
          <div className="bg-green-50 p-3 rounded-md border border-green-200 mt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p className="font-medium text-green-800 text-sm">Selected Text</p>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    if (editInputRef.current) {
                      editInputRef.current.focus();
                    }
                  }}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                >
                  Edit
                </button>
                {selectedText.editedText !== undefined && (
                  <button
                    onClick={() => onTextEdit?.(selectedText, selectedText.text)}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            
            <div className="relative mb-2">
              <input
                key={`edit-${selectedText.text}-${selectedText.bbox.join('-')}`}
                ref={editInputRef}
                type="text"
                className="w-full p-2 border rounded text-sm text-gray-900 bg-white"
                value={selectedText.editedText !== undefined ? selectedText.editedText : selectedText.text}
                onChange={(e) => {
                  // Immediately update the input value
                  e.target.value = e.target.value; 
                  onTextEdit?.(selectedText, e.target.value);
                }}
              />
            </div>
            
            <div className="flex justify-end mt-3 mb-1">
              <button
                onClick={() => {
                  // Get all textLines from this page and pass them to save function via onTextEdit
                  if (textLines.length > 0 && onTextEdit) {
                    onTextEdit({ ...textLines[0], text: '___SAVE_ALL_TEXTS___' }, '___SAVE_ALL_TEXTS___');
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                </svg>
                Save Changes
              </button>
            </div>
            
            {selectedText.editedText !== undefined && selectedText.editedText !== selectedText.text && (
              <div className="flex items-center gap-1 mb-2 text-xs bg-yellow-50 rounded p-1.5 border border-yellow-200">
                <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-yellow-800">Original: </span>
                <span className="text-yellow-900 italic">{selectedText.text}</span>
              </div>
            )}
            
            <div className="flex text-xs mt-1 gap-2">
              {(() => {
                const confidence = selectedText.confidence * 100;
                let bgColor, textColor, label;
                
                if (confidence >= 65) {
                  bgColor = 'bg-green-100';
                  textColor = 'text-green-800';
                  label = 'High';
                } else if (confidence >= 40) {
                  bgColor = 'bg-blue-100';
                  textColor = 'text-blue-800';
                  label = 'Moderate';
                } else {
                  bgColor = 'bg-red-100';
                  textColor = 'text-red-800';
                  label = 'Low';
                }
                
                return (
                  <span className={`px-1.5 py-0.5 rounded flex items-center ${bgColor} ${textColor}`}>
                    <span className={`w-2 h-2 rounded-full mr-1 ${bgColor.replace('100', '500')}`}></span>
                    {label} confidence
                  </span>
                );
              })()}
              
              <span>•</span>
              
              <span className="text-green-600">
                Position: {selectedText.bbox[0].toFixed(0)}, {selectedText.bbox[1].toFixed(0)}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-2">
          
          {textLines.map((line, i) => (
            <div
              key={i}
              ref={el => itemRefs.current[i] = el}
              className={`p-3 rounded cursor-pointer transition-colors ${
                selectedText === line
                  ? 'bg-blue-100 border-blue-500'
                  : 'bg-white hover:bg-gray-100 border-gray-200'
              } border text-sm`}
              onClick={() => onTextClick?.(line)}
            >
              <p className="font-medium break-words">{line.editedText !== undefined ? line.editedText : line.text}</p>
              {line.editedText !== undefined && line.editedText !== line.text && (
                <p className="text-xs text-gray-500 mt-1 italic">Original: {line.text}</p>
              )}
              <div className="flex justify-between items-center mt-2 text-xs">
                {/* Confidence level indicator with color coding */}
                {(() => {
                  const confidence = line.confidence * 100;
                  let bgColor, textColor, label;
                  
                  if (confidence >= 65) {
                    bgColor = 'bg-green-100';
                    textColor = 'text-green-800';
                    label = 'High';
                  } else if (confidence >= 40) {
                    bgColor = 'bg-blue-100';
                    textColor = 'text-blue-800';
                    label = 'Moderate';
                  } else {
                    bgColor = 'bg-red-100';
                    textColor = 'text-red-800';
                    label = 'Low';
                  }
                  
                  return (
                    <span className={`px-2 py-1 rounded flex items-center ${bgColor} ${textColor}`}>
                      <span className={`w-2 h-2 rounded-full mr-1 ${bgColor.replace('100', '500')}`}></span>
                      {label} confidence
                    </span>
                  );
                })()}
                <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">
                  Position: {line.bbox[0].toFixed(0)}, {line.bbox[1].toFixed(0)}
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
};

export default TextSidebar;