'use client';

import { useState } from 'react';
import { Annotation, AnnotationType } from '@/types/pdf';
import { utils, writeFile } from 'xlsx';

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
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  
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
      
      // Determine if we're using the new or legacy format
      if (typeof annotation.result === 'object' && annotation.result.html) {
        // New format with title, description, and HTML
        // Create a temporary container to parse the HTML
        const container = document.createElement('div');
        container.innerHTML = annotation.result.html;
        
        // Find the table element
        const tableEl = container.querySelector('table');
        if (!tableEl) {
          throw new Error("No table found in HTML");
        }
        
        // Convert the table to a worksheet
        const ws = utils.table_to_sheet(tableEl);
        
        // Add the worksheet to the workbook
        // Use the table title if available, otherwise use a default name
        const sheetName = annotation.result.title 
          ? annotation.result.title.substring(0, 30) // XLSX has a 31 char limit for sheet names
          : `Table ${annotationId.substring(0, 8)}`;
        
        utils.book_append_sheet(wb, ws, sheetName);
      } 
      else if (Array.isArray(annotation.result)) {
        // Legacy format - array of HTML strings
        annotation.result.forEach((htmlTable, idx) => {
          // Create a temporary container to parse the HTML
          const container = document.createElement('div');
          container.innerHTML = htmlTable;
          
          // Find the table element
          const tableEl = container.querySelector('table');
          if (!tableEl) {
            return; // Skip this one if no table is found
          }
          
          // Convert the table to a worksheet
          const ws = utils.table_to_sheet(tableEl);
          
          // Add the worksheet to the workbook
          utils.book_append_sheet(wb, ws, `Table ${idx + 1}`);
        });
        
        // If no tables were found, throw an error
        if (wb.SheetNames.length === 0) {
          throw new Error("No valid tables found in the data");
        }
      } 
      else {
        throw new Error("Unsupported table format");
      }
      
      // Generate filename from annotation ID
      const filename = `table_${annotationId.substring(0, 8)}.xlsx`;
      
      // Write the workbook and trigger download
      writeFile(wb, filename);
      
      // Reset loading state
      setExportLoading(null);
    } catch (error) {
      console.error("Error exporting table:", error);
      setExportLoading(null);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Function to export all tables at once
  const exportAllTables = () => {
    setExportLoading('all');
    
    try {
      // Filter processed table annotations
      const tableAnnotations = annotations.filter(
        a => a.type === AnnotationType.TABLE && a.processed && a.result
      );
      
      if (tableAnnotations.length === 0) {
        throw new Error("No processed tables to export");
      }
      
      // Create a new workbook
      const wb = utils.book_new();
      let tablesAdded = 0;
      
      // Process each table annotation
      tableAnnotations.forEach((annotation, annotationIndex) => {
        // Handle new format with title, description, and HTML
        if (typeof annotation.result === 'object' && annotation.result.html) {
          // Create a temporary container to parse the HTML
          const container = document.createElement('div');
          container.innerHTML = annotation.result.html;
          
          // Find the table element
          const tableEl = container.querySelector('table');
          if (!tableEl) return; // Skip if no table found
          
          // Convert the table to a worksheet
          const ws = utils.table_to_sheet(tableEl);
          
          // Add the worksheet to the workbook
          // Use the table title if available, otherwise a default name
          const sheetName = annotation.result.title 
            ? annotation.result.title.substring(0, 30) // XLSX has a 31 char limit for sheet names
            : `Table ${annotationIndex + 1}`;
          
          utils.book_append_sheet(wb, ws, sheetName);
          tablesAdded++;
        }
        // Handle legacy format - array of HTML strings
        else if (Array.isArray(annotation.result)) {
          annotation.result.forEach((htmlTable, idx) => {
            // Create a temporary container to parse the HTML
            const container = document.createElement('div');
            container.innerHTML = htmlTable;
            
            // Find the table element
            const tableEl = container.querySelector('table');
            if (!tableEl) return; // Skip if no table found
            
            // Convert the table to a worksheet
            const ws = utils.table_to_sheet(tableEl);
            
            // Add the worksheet to the workbook
            utils.book_append_sheet(wb, ws, `Table ${annotationIndex + 1}_${idx + 1}`);
            tablesAdded++;
          });
        }
      });
      
      // If no tables were added, throw an error
      if (tablesAdded === 0) {
        throw new Error("No valid tables found to export");
      }
      
      // Generate filename
      const filename = `tables_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      // Write the workbook and trigger download
      writeFile(wb, filename);
    } catch (error) {
      console.error("Error exporting tables:", error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportLoading(null);
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
                      <div className="mt-2 overflow-auto">
                        {/* Export single table button */}
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
                ))}
              </div>
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