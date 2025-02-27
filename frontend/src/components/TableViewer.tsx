import { useEffect, useRef } from 'react';
import { TableData, TableBBox } from '@/types/pdf';

interface TableViewerProps {
  tableData: TableData;
  onTableClick?: (tableBox: TableBBox) => void;
  selectedTable?: TableBBox;
}

export default function TableViewer({ tableData, onTableClick, selectedTable }: TableViewerProps) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const { bbox_data, html = [] } = tableData;
  
  // Add debug log to see what data we're receiving
  console.log("TableViewer received data:", tableData);

  // Auto-scroll to selected table
  useEffect(() => {
    if (selectedTable) {
      const index = bbox_data.findIndex(box => box === selectedTable);
      if (index !== -1 && itemRefs.current[index]) {
        itemRefs.current[index]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedTable, bbox_data]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      <div className="p-4 border-b bg-white">
        <h2 className="text-xl font-bold">Extracted Tables</h2>
        <p className="text-sm text-gray-500 mt-1">
          {bbox_data.length} table{bbox_data.length !== 1 ? 's' : ''} found
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {bbox_data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No tables found in this page
          </div>
        ) : (
          <div className="space-y-6">
            {bbox_data.map((box, i) => (
              <div
                key={i}
                ref={el => itemRefs.current[i] = el}
                className={`p-4 rounded cursor-pointer transition-colors ${
                  selectedTable === box
                    ? 'bg-blue-50 border-blue-500'
                    : 'bg-white hover:bg-gray-50 border-gray-200'
                } border`}
                onClick={() => onTableClick?.(box)}
              >
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-blue-700">Table {i + 1}</h3>
                  <span className="text-xs text-gray-500">
                    Coordinates: {box.xyxy[0].toFixed(0)}, {box.xyxy[1].toFixed(0)}
                  </span>
                </div>
                
                {/* HTML Table Rendering */}
                {html && i < html.length && html[i] ? (
                  <div 
                    className="overflow-auto max-h-80 border rounded p-2"
                    dangerouslySetInnerHTML={{ 
                      __html: `
                        <style>
                          table {
                            border-collapse: collapse;
                            width: 100%;
                            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
                            font-size: 0.875rem;
                          }
                          th, td {
                            border: 1px solid #e5e7eb;
                            padding: 8px;
                            text-align: left;
                          }
                          th {
                            background-color: #f9fafb;
                            font-weight: 600;
                          }
                          tr:nth-child(even) {
                            background-color: #f3f4f6;
                          }
                          tr:hover {
                            background-color: #e5e7eb;
                          }
                        </style>
                        ${html[i]}
                      `
                    }} 
                  />
                ) : (
                  <div className="text-center py-4 text-gray-500 bg-gray-50 rounded">
                    {/* Add debugging info */}
                    <div>No HTML content available for this table</div>
                    <div className="text-xs mt-2">Debug Info:</div>
                    <div className="text-xs">HTML array length: {html ? html.length : 0}</div>
                    <div className="text-xs">Current index: {i}</div>
                    {html && html.length > 0 && (
                      <div className="text-xs">
                        Available indices: {Array.from({length: html.length}, (_, idx) => idx).join(', ')}
                      </div>
                    )}
                    {html && i < html.length && (
                      <details className="text-xs mt-2">
                        <summary>Raw HTML (might be empty)</summary>
                        <div className="text-left p-2 bg-gray-100 mt-1 overflow-auto max-h-40">
                          <code>{html[i] || "(empty string)"}</code>
                        </div>
                      </details>
                    )}
                  </div>
                )}
                
                {/* Display class info */}
                <div className="mt-2 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-1 rounded">
                    {box.class_id === 0 ? 'Normal Table' : 
                     box.class_id === 1 ? 'Tilted Table' : 
                     box.class_id === 2 ? 'Empty Table' : 
                     `Table Type: ${box.class_id}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}