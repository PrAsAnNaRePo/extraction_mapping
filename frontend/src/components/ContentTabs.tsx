'use client';

import { useState } from 'react';
import { Annotation, AnnotationType } from '@/types/pdf';
import { utils, writeFile } from 'xlsx';
import { EditableTable } from './EditableTable';
import FieldExtractionPanel from './FieldExtractionPanel';
import ExtractedFieldsDisplay from './ExtractedFieldsDisplay';

interface ContentTabsProps {
  annotations: Annotation[];
  textContent?: React.ReactNode;
  currentTab?: AnnotationType;
  onTabChange?: (tab: AnnotationType) => void;
  onAnnotationsUpdate?: (annotations: Annotation[]) => void;
  onExtractFields?: (fields: { [key: string]: string }) => Promise<void>;
  isExtractingFields?: boolean;
  extractedFields?: { [key: string]: string };
}

const convertHtmlTableToArray = (htmlString: string): string[][] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];

  return Array.from(table.rows).map(row => 
    Array.from(row.cells).map(cell => cell.textContent || '')
  );
};

export default function ContentTabs({
  annotations,
  textContent,
  currentTab = AnnotationType.TEXT,
  onTabChange,
  onAnnotationsUpdate,
  onExtractFields,
  isExtractingFields,
  extractedFields
}: ContentTabsProps) {
  const [activeTab, setActiveTab] = useState<AnnotationType>(currentTab);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [editedTables, setEditedTables] = useState<Record<string, string[][]>>({});
  
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
  
  // Function to convert HTML table to Excel workbook and trigger download
  const exportTableToExcel = (annotationId: string) => {
    setExportLoading(annotationId);
    
    try {
      // Find the annotation
      const annotation = annotations.find(a => a.id === annotationId);
      if (!annotation || !annotation.result) {
        throw new Error("Table data not found");
      }

      // Create a new workbook
      const wb = utils.book_new();
      
      // Use edited data if available, otherwise use original data
      const tableData = editedTables[annotationId] || convertHtmlTableToArray(
        typeof annotation.result === 'object' ? annotation.result.html : annotation.result[0]
      );
      
      // Convert the array data to a worksheet
      const ws = utils.aoa_to_sheet(tableData);
      
      // Add the worksheet to the workbook
      const sheetName = typeof annotation.result === 'object' && annotation.result.title
        ? annotation.result.title.substring(0, 30)
        : `Table ${annotationId.substring(0, 8)}`;
      
      utils.book_append_sheet(wb, ws, sheetName);
      
      // Trigger download
      writeFile(wb, `${sheetName}.xlsx`);
      
    } catch (error) {
      console.error('Error exporting table:', error);
    } finally {
      setExportLoading(null);
    }
  };
  
  // Function to export all tables at once
  const exportAllTables = () => {
    setExportLoading('all');
    
    try {
      const wb = utils.book_new();
      let hasData = false;
      
      filteredAnnotations.forEach((annotation, index) => {
        if (!annotation.processed || !annotation.result) return;
        
        // Use edited data if available, otherwise use original data
        const tableData = editedTables[annotation.id] || convertHtmlTableToArray(
          typeof annotation.result === 'object' ? annotation.result.html : annotation.result[0]
        );
        
        const ws = utils.aoa_to_sheet(tableData);
        
        const sheetName = typeof annotation.result === 'object' && annotation.result.title
          ? annotation.result.title.substring(0, 30)
          : `Table ${index + 1}`;
        
        utils.book_append_sheet(wb, ws, sheetName);
        hasData = true;
      });
      
      if (!hasData) {
        throw new Error("No valid tables found");
      }
      
      writeFile(wb, 'all_tables.xlsx');
      
    } catch (error) {
      console.error('Error exporting all tables:', error);
    } finally {
      setExportLoading(null);
    }
  };

  // Update the handleTableSave function to handle all table operations
  const handleTableSave = async (data: string[][], row: number, col: number, annotationId: string) => {
    try {
      console.log(`Saving table edit for annotation ${annotationId}, row ${row}, col ${col}`);
      
      // Update local state immediately for a responsive UI
      setEditedTables(prev => ({
        ...prev,
        [annotationId]: data
      }));
      
      // Use the correct backend URL with error handling
      try {
        const response = await fetch('http://localhost:3002/api/table/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tableData: data,
            row,
            col,
            annotationId
          }),
        });

        if (!response.ok) {
          console.error(`Server responded with status: ${response.status}`);
          // Continue with UI updates even if server request fails
        } else {
          const result = await response.json();
          console.log('Table save response:', result);
        }
      } catch (fetchError) {
        console.error('Network error when saving table:', fetchError);
        // Continue with UI updates even if server request fails
      }
    } catch (error) {
      console.error('Error in handleTableSave:', error);
    }
  };

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

          {/* Fields tab - show if we have content to extract from or fields already extracted */}
          {((textCount > 0 || tableCount > 0 || diagramCount > 0) || (extractedFields && Object.keys(extractedFields).length > 0)) && (
            <button
              onClick={() => handleTabChange(AnnotationType.FIELDS)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === AnnotationType.FIELDS
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } transition-colors`}
            >
              Fields {extractedFields && Object.keys(extractedFields).length > 0 && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                  {Object.keys(extractedFields).length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-2">
        {activeTab === AnnotationType.TEXT && (
          <div className="space-y-3">
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
                          // Handle the new text extraction format
                          <div className="space-y-3">
                            {/* Title */}
                            {annotation.result.title && (
                              <div>
                                <h3 className="text-blue-700 font-medium text-base">Title:</h3>
                                <p className="font-semibold">{annotation.result.title}</p>
                              </div>
                            )}
                            
                            {/* Description */}
                            {annotation.result.description && (
                              <div>
                                <h3 className="text-blue-700 font-medium text-base">Description:</h3>
                                <p className="text-gray-800">{annotation.result.description}</p>
                              </div>
                            )}
                            
                            {/* Extracted Content */}
                            {annotation.result.extracted_content && (
                              <div>
                                <h3 className="text-blue-700 font-medium text-base">Extracted Content:</h3>
                                <div className="bg-gray-100 p-2 rounded whitespace-pre-wrap font-mono text-xs">
                                  {annotation.result.extracted_content}
                                </div>
                              </div>
                            )}
                          </div>
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
          <div className="space-y-3">
            {filteredAnnotations.length === 0 ? (
              <p className="text-gray-500">No table annotations yet.</p>
            ) : (
              <div>
                {/* Export all tables button */}
                {filteredAnnotations.some(a => a.processed && a.result) && (
                  <div className="mb-4 flex justify-end">
                    <button
                      onClick={exportAllTables}
                      disabled={exportLoading !== null}
                      className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium text-sm px-3 py-1.5 rounded-md flex items-center transition shadow-sm"
                    >
                      {exportLoading === 'all' ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-yellow-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Exporting...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Export All Tables to Excel
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {filteredAnnotations.map((annotation, index) => (
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
                      <div className="mt-2 overflow-auto w-full">
                        <div className="mb-2 flex justify-end">
                          <button
                            onClick={() => exportTableToExcel(annotation.id)}
                            disabled={exportLoading !== null}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded flex items-center transition"
                          >
                            {exportLoading === annotation.id ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Exporting...
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export to Excel
                              </>
                            )}
                          </button>
                        </div>
                        <div className="border rounded overflow-hidden w-full">
                          <EditableTable
                            data={editedTables[annotation.id] || convertHtmlTableToArray(
                              typeof annotation.result === 'object' ? annotation.result.html : annotation.result[0]
                            )}
                            onSave={(data, row, col) => handleTableSave(data, row, col, annotation.id)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-gray-500 italic">
                        Process this annotation to extract the table.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === AnnotationType.DIAGRAM && (
          <div className="space-y-3">
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
        
        {activeTab === AnnotationType.FIELDS && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {onExtractFields && annotations.length > 0 ? (
              <>
                <FieldExtractionPanel
                  onExtractFields={onExtractFields}
                  isLoading={isExtractingFields}
                />
                {extractedFields && Object.keys(extractedFields).length > 0 && (
                  <ExtractedFieldsDisplay
                    fields={extractedFields}
                    className="mt-8"
                  />
                )}
              </>
            ) : (
              <div className="p-6 text-center bg-gray-50 rounded-lg">
                <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No Content Available</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Please process some content before attempting to extract fields.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}