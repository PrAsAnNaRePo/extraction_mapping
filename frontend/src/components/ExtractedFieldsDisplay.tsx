'use client';

import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import React from 'react';

type ExtractedFieldsDisplayProps = {
  fields: Record<string, string>;
  className?: string;
};

type FieldInfo = {
  name: string;
  value: string;
  type: 'text' | 'number' | 'date' | 'list';
  confidence?: number;
};

const ExtractedFieldsDisplay = ({ fields, className = '' }: ExtractedFieldsDisplayProps) => {
  // Helper function to copy field value to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };
  
  if (!fields || Object.keys(fields).length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-lg ${className}`}>
        <div className="p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Fields Extracted</h3>
          <p className="mt-2 text-sm text-gray-600">
            No fields were found in the processed content. Try adjusting your field descriptions or processing more content.
          </p>
        </div>
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const getFieldIcon = (type: string) => {
    const icons = {
      text: (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      number: (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      ),
      date: (
        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      list: (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      )
    };
    return icons[type as keyof typeof icons] || icons.text;
  };

  const parseFieldValue = (fieldValue: string): { value: string; confidence?: number } => {
    const [rawValue, ...meta] = fieldValue.split('(');
    const value = rawValue.trim();
    const metaInfo = meta.join('(');

    try {
      const type = metaInfo.match(/Type:\s*([^,)]+)/)?.[1] || 'text';
      const confidenceMatch = metaInfo.match(/Confidence:\s*([\d.]+)/)?.[1];
      const confidence = confidenceMatch ? parseFloat(confidenceMatch) : undefined;

      let formattedValue = value;

      switch (type.toLowerCase()) {
        case 'list':
          formattedValue = value.split(',').map(v => v.trim()).join('\n• ');
          if (formattedValue) formattedValue = '• ' + formattedValue;
          break;
        case 'number':
          const num = parseFloat(value);
          if (!isNaN(num)) formattedValue = num.toLocaleString();
          break;
        case 'date':
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            formattedValue = new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }).format(date);
          }
          break;
      }

      return { value: formattedValue, confidence };
    } catch {
      return { value };
    }
  };

  const parsedFields = Object.entries(fields).map(([name, value]) => {
    const type = value.match(/Type: ([^,)]+)/)?.[1] || 'text';
    const parsedValue = parseFieldValue(value);
    return { name, type, ...parsedValue };
  });

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Extracted Fields</h3>
          <p className="text-sm text-gray-600">Results from the field extraction process</p>
        </div>
        <button 
          onClick={() => {
            const csvContent = parsedFields
              .map(({ name, value }) => `${name},${value}`)
              .join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'extracted_fields.csv';
            a.click();
            window.URL.revokeObjectURL(url);
          }}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>
      
      <motion.div 
        className="p-4 space-y-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {parsedFields.map(({ name, type, value, confidence }, index) => (
          <motion.div
            key={index}
            variants={item}
            className="bg-gray-50 rounded-lg p-4 relative group hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {getFieldIcon(type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {name}
                  </h4>
                  <div className="flex items-center gap-2">
                    {confidence && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-50 text-green-700">
                        {Math.round(confidence * 100)}% confident
                      </span>
                    )}
                    <button
                      onClick={() => copyToClipboard(value)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
                      title="Copy to clipboard"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      {
                        text: 'bg-blue-100 text-blue-800',
                        number: 'bg-green-100 text-green-800',
                        date: 'bg-purple-100 text-purple-800',
                        list: 'bg-orange-100 text-orange-800'
                      }[type] || 'bg-gray-100 text-gray-800'
                    }`}>
                      {type}
                    </span>
                  </div>
                </div>
                <div className="mt-1">
                  <div className={`text-sm whitespace-pre-wrap break-words ${confidence && confidence < 0.7 ? 'bg-yellow-50 p-2 rounded border border-yellow-100' : ''} ${
                    type === 'number' ? 'font-mono text-green-700' :
                    type === 'date' ? 'font-medium text-purple-700' :
                    type === 'list' ? 'text-orange-700' :
                    'text-gray-700'
                  }`}>
                    {value}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default ExtractedFieldsDisplay;