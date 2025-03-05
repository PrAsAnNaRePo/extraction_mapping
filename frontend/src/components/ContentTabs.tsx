'use client';

import { useState } from 'react';
import { Annotation, AnnotationType } from '@/types/pdf';

interface ContentTabsProps {
  annotations: Annotation[];
  textContent?: React.ReactNode;
  currentTab?: AnnotationType;
  onTabChange?: (tab: AnnotationType) => void;
}

export default function ContentTabs({
  annotations,
  textContent,
  currentTab = AnnotationType.TEXT,
  onTabChange
}: ContentTabsProps) {
  const [activeTab, setActiveTab] = useState<AnnotationType>(currentTab);
  
  const textCount = annotations.filter(a => a.type === AnnotationType.TEXT).length;
  const tableCount = annotations.filter(a => a.type === AnnotationType.TABLE).length;
  const diagramCount = annotations.filter(a => a.type === AnnotationType.DIAGRAM).length;
  
  const handleTabChange = (tab: AnnotationType) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };
  
  // Filter annotations based on active tab
  const filteredAnnotations = annotations.filter(a => a.type === activeTab);
  
  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Tabs */}
      <div className="border-b">
        <div className="flex">
          <button
            onClick={() => handleTabChange(AnnotationType.TEXT)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === AnnotationType.TEXT
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } transition-colors`}
          >
            Text {textCount > 0 && <span className="ml-1 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">{textCount}</span>}
          </button>
          
          <button
            onClick={() => handleTabChange(AnnotationType.TABLE)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === AnnotationType.TABLE
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } transition-colors`}
          >
            Tables {tableCount > 0 && <span className="ml-1 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">{tableCount}</span>}
          </button>
          
          <button
            onClick={() => handleTabChange(AnnotationType.DIAGRAM)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === AnnotationType.DIAGRAM
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } transition-colors`}
          >
            Diagrams {diagramCount > 0 && <span className="ml-1 text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full">{diagramCount}</span>}
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === AnnotationType.TEXT && (
          <div className="space-y-4">
            {textContent || (
              filteredAnnotations.length === 0 ? (
                <p className="text-gray-500">No text annotations yet.</p>
              ) : (
                filteredAnnotations.map((annotation, index) => (
                  <div key={annotation.id} className="p-3 border rounded-md bg-gray-50">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-gray-700">Text Region {index + 1}</h3>
                      <span className={`px-2 py-1 text-xs rounded ${
                        annotation.processed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {annotation.processed ? 'Processed' : 'Pending'}
                      </span>
                    </div>
                    {annotation.result ? (
                      <div className="mt-2 text-sm">
                        {Array.isArray(annotation.result) ? 
                          annotation.result.map((result, idx) => (
                            <div key={idx} className="mb-2">
                              {result.text_lines?.map((textLine, lineIdx) => (
                                <div key={lineIdx} className="mb-1">
                                  <div className="text-blue-700 font-medium">Text {lineIdx+1}:</div>
                                  <div>{textLine.text}</div>
                                  <div className="text-gray-500 text-xs">Confidence: {(textLine.confidence * 100).toFixed(1)}%</div>
                                </div>
                              ))}
                            </div>
                          )) 
                          : 
                          annotation.result
                        }
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-gray-500 italic">
                        Process this annotation to extract the text.
                      </div>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        )}
        
        {activeTab === AnnotationType.TABLE && (
          <div className="space-y-4">
            {filteredAnnotations.length === 0 ? (
              <p className="text-gray-500">No table annotations yet.</p>
            ) : (
              filteredAnnotations.map((annotation, index) => (
                <div key={annotation.id} className="p-3 border rounded-md bg-gray-50">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-gray-700">Table {index + 1}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${
                      annotation.processed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {annotation.processed ? 'Processed' : 'Pending'}
                    </span>
                  </div>
                  {annotation.result ? (
                    <div className="mt-2 overflow-auto">
                      {Array.isArray(annotation.result) && annotation.result.length > 0 ? (
                        // Legacy format - array of HTML strings
                        annotation.result.map((htmlTable, idx) => (
                          <div key={idx} className="mb-4 border p-2 rounded">
                            <div dangerouslySetInnerHTML={{ __html: htmlTable }} />
                          </div>
                        ))
                      ) : annotation.result.title && annotation.result.description && annotation.result.html ? (
                        // New format with title, description and HTML
                        <div className="mb-4">
                          <h4 className="font-medium text-gray-800 mb-1 text-yellow-700">{annotation.result.title}</h4>
                          <p className="text-sm text-gray-600 mb-3">{annotation.result.description}</p>
                          <div className="border p-2 rounded bg-white overflow-auto">
                            <div className="table-responsive" dangerouslySetInnerHTML={{ __html: annotation.result.html }} />
                          </div>
                        </div>
                      ) : (
                        // Fallback for other formats
                        <div dangerouslySetInnerHTML={{ __html: Array.isArray(annotation.result) ? 'No table data extracted' : (annotation.result.html || annotation.result) }} />
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-500 italic">
                      Process this annotation to extract the table data.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        
        {activeTab === AnnotationType.DIAGRAM && (
          <div className="space-y-4">
            {filteredAnnotations.length === 0 ? (
              <p className="text-gray-500">No diagram annotations yet.</p>
            ) : (
              filteredAnnotations.map((annotation, index) => (
                <div key={annotation.id} className="p-3 border rounded-md bg-gray-50">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-gray-700">Diagram {index + 1}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${
                      annotation.processed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {annotation.processed ? 'Processed' : 'Pending'}
                    </span>
                  </div>
                  {annotation.result ? (
                    <div className="mt-2">
                      <h4 className="font-medium text-sm">Diagram Heading:</h4>
                      <p className="mt-1 text-sm">{annotation.result.diag_heading}</p>
                      
                      <h4 className="font-medium text-sm mt-3">Description:</h4>
                      <p className="mt-1 text-sm">{annotation.result.diag_description}</p>
                      
                      {annotation.result.annotations && annotation.result.annotations.length > 0 && (
                        <>
                          <h4 className="font-medium text-sm mt-3">Annotations:</h4>
                          <ul className="mt-1 space-y-2">
                            {annotation.result.annotations.map((element: any, i: number) => (
                              <li key={i} className="text-sm border-l-2 border-purple-300 pl-2">
                                <span className="font-medium">{element.marking}:</span> {element.description}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-500 italic">
                      Process this annotation to extract the diagram information.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}