import { useEffect, useRef } from 'react';
import { Annotation, OCRResult, OCRTextLine } from '@/types/pdf';

interface TextSidebarProps {
  annotations: Annotation[];
  onTextClick?: (textLine: OCRTextLine) => void;
  selectedText?: OCRTextLine;
  onTextEdit?: (textLine: OCRTextLine, newText: string) => void;
}

const TextSidebar = ({ annotations, onTextClick, selectedText, onTextEdit }: TextSidebarProps) => {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to selected text
  useEffect(() => {
    if (selectedText && itemRefs.current.length > 0) {
      const index = 0; // Just scroll to first item when text is selected
      itemRefs.current[index]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedText]);

  // Filter only text annotations that have been processed
  const textAnnotations = annotations.filter(
    annotation => annotation.type === 'text' && annotation.processed && annotation.result
  );

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      <div className="p-3 border-b bg-white">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-gray-800">Extracted Text</h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
            {textAnnotations.length} items
          </span>
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
                  onTextEdit?.(selectedText, e.target.value);
                }}
              />
            </div>
            
            <div className="flex justify-end mt-3 mb-1">
              <button
                onClick={() => {
                  if (onTextEdit && selectedText) {
                    onTextEdit({ ...selectedText, text: '___SAVE_ALL_TEXTS___' }, '___SAVE_ALL_TEXTS___');
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
              <span className="text-green-600">
                Position: {selectedText.bbox[0].toFixed(0)}, {selectedText.bbox[1].toFixed(0)}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-4">
          
          {textAnnotations.map((annotation, i) => {
            // Get the structure based on what the text extractor returns
            const textData = annotation.result as any;
            const title = textData.title || 'Text Content';
            const description = textData.description || '';
            const content = textData.extracted_content || '';
            
            return (
              <div
                key={annotation.id}
                ref={el => itemRefs.current[i] = el}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <h3 className="text-md font-bold text-gray-900 mb-1">{title}</h3>
                {description && (
                  <p className="text-sm text-gray-600 mb-3 italic">{description}</p>
                )}
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <pre className="text-sm whitespace-pre-wrap text-gray-800 font-mono">{content}</pre>
                </div>
                
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => {
                      // Copy text to clipboard
                      navigator.clipboard.writeText(content);
                      // Show toast or some feedback here
                    }}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy
                  </button>
                </div>
              </div>
            );
          })}
          
          {textAnnotations.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">No text annotations yet</p>
              <p className="text-sm mt-1">Create and process text annotations to see content here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextSidebar;