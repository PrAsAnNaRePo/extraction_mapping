'use client';

import { useState } from 'react';
import { AnnotationType } from '@/types/pdf';

interface AnnotationControlsProps {
  annotationMode: boolean;
  onToggleAnnotationMode: () => void;
  currentAnnotationType: AnnotationType;
  onAnnotationTypeChange: (type: AnnotationType) => void;
  onDetectTables?: () => void;
  onProcessAnnotations?: () => void;
  annotationsCount: number;
}

export default function AnnotationControls({
  annotationMode,
  onToggleAnnotationMode,
  currentAnnotationType,
  onAnnotationTypeChange,
  onDetectTables,
  onProcessAnnotations,
  annotationsCount
}: AnnotationControlsProps) {
  return (
    <div className="bg-white p-2 border-b flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleAnnotationMode}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            annotationMode
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {annotationMode ? 'Drawing Mode' : 'View Mode'}
        </button>

        {annotationMode && (
          <div className="flex items-center space-x-2 border-l pl-3 ml-2">
            <span className="text-sm text-gray-500">Select type:</span>
            <div className="flex gap-1">
              <button
                onClick={() => onAnnotationTypeChange(AnnotationType.TEXT)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  currentAnnotationType === AnnotationType.TEXT
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Text annotation"
              >
                Text
              </button>
              <button
                onClick={() => onAnnotationTypeChange(AnnotationType.TABLE)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  currentAnnotationType === AnnotationType.TABLE
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Table annotation"
              >
                Table
              </button>
              <button
                onClick={() => onAnnotationTypeChange(AnnotationType.DIAGRAM)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  currentAnnotationType === AnnotationType.DIAGRAM
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Diagram annotation"
              >
                Diagram
              </button>
            </div>
          </div>
        )}

        {annotationMode && onDetectTables && (
          <button
            onClick={onDetectTables}
            className="px-2 py-1 ml-2 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
            title="Automatically detect tables"
          >
            Auto-detect Tables
          </button>
        )}
      </div>

      {annotationsCount > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {annotationsCount} area{annotationsCount !== 1 ? 's' : ''} selected
          </span>
          {onProcessAnnotations && (
            <button
              onClick={onProcessAnnotations}
              className="px-3 py-1.5 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              Process Annotations
            </button>
          )}
        </div>
      )}
    </div>
  );
}