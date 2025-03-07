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
  rotation?: number;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
  onResetRotation?: () => void;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
}

export default function AnnotationControls({
  annotationMode,
  onToggleAnnotationMode,
  currentAnnotationType,
  onAnnotationTypeChange,
  onDetectTables,
  onProcessAnnotations,
  annotationsCount,
  rotation = 0,
  onRotateLeft,
  onRotateRight,
  onResetRotation,
  zoomLevel = 1,
  onZoomIn,
  onZoomOut,
  onResetZoom
}: AnnotationControlsProps) {
  return (
    <div className="bg-white p-2 border-b flex items-center justify-between">
      <div className="flex items-center space-x-3">
        {/* Mode toggle */}
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

        {/* Rotation Controls */}
        <div className="flex items-center space-x-1 border-l pl-3 ml-1">
          <span className="text-xs text-gray-500">Rotation:</span>
          <div className="flex gap-1 items-center">
            <button 
              onClick={onRotateLeft}
              className="p-1 rounded hover:bg-gray-100 text-gray-700"
              title="Rotate Left 90°"
              disabled={!onRotateLeft}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            
            <span className="text-xs font-medium">{rotation || 0}°</span>
            
            <button 
              onClick={onRotateRight}
              className="p-1 rounded hover:bg-gray-100 text-gray-700"
              title="Rotate Right 90°"
              disabled={!onRotateRight}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
            
            {rotation !== 0 && onResetRotation && (
              <button 
                onClick={onResetRotation}
                className="p-1 rounded hover:bg-gray-100 text-gray-700"
                title="Reset Rotation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Zoom Controls */}
        {onZoomIn && onZoomOut && (
          <div className="flex items-center space-x-1 border-l pl-3 ml-1">
            <span className="text-xs text-gray-500">Zoom:</span>
            <div className="flex gap-1 items-center">
              <button 
                onClick={onZoomOut}
                className="p-1 rounded hover:bg-gray-100 text-gray-700"
                title="Zoom Out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              
              <span className="text-xs font-medium">{Math.round(zoomLevel * 100)}%</span>
              
              <button 
                onClick={onZoomIn}
                className="p-1 rounded hover:bg-gray-100 text-gray-700"
                title="Zoom In"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              
              {zoomLevel !== 1 && onResetZoom && (
                <button 
                  onClick={onResetZoom}
                  className="p-1 rounded hover:bg-gray-100 text-gray-700"
                  title="Reset Zoom"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Annotation Type Selection */}
        {annotationMode && (
          <div className="flex items-center space-x-2 border-l pl-3 ml-1">
            <span className="text-xs text-gray-500">Type:</span>
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

        {/* Auto-detect Tables button */}
        {annotationMode && onDetectTables && (
          <button
            onClick={onDetectTables}
            className="px-3 py-1.5 ml-2 rounded text-sm font-medium bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors"
            title="Automatically detect tables"
          >
            Auto-detect Tables
          </button>
        )}
      </div>

      {onProcessAnnotations && annotationsCount > 0 && (
        <div className="flex items-center gap-3 mr-4">
          {/* {currentAnnotationType !== AnnotationType.TABLE && (
            <span className="text-sm text-gray-600">
              {annotationsCount} area{annotationsCount !== 1 ? 's' : ''} selected
            </span>
          )} */}
          <button
            onClick={onProcessAnnotations}
            className="px-4 py-1.5 rounded text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm"
          >
            Process Annotations
          </button>
        </div>
      )}
    </div>
  );
}