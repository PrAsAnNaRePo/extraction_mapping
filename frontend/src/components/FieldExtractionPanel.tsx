'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Field {
  name: string;
  description: string;
  type: 'text' | 'number' | 'date' | 'list';
}

interface FieldExtractionPanelProps {
  onExtractFields?: (fields: { [key: string]: string }) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

const fieldTypes = [
  { value: 'text', label: 'Text', description: 'Extract text content' },
  { value: 'number', label: 'Number', description: 'Extract numerical values' },
  { value: 'date', label: 'Date', description: 'Extract dates' },
  { value: 'list', label: 'List', description: 'Extract multiple items' },
];

const commonFields = [
  { name: 'Title', description: 'Extract the main title or heading', type: 'text' },
  { name: 'Date', description: 'Extract any dates mentioned', type: 'date' },
  { name: 'Dimensions', description: 'Extract dimensional measurements', type: 'number' },
  { name: 'Parts', description: 'Extract list of parts or components', type: 'list' },
];

export default function FieldExtractionPanel({ onExtractFields, isLoading = false, className = '' }: FieldExtractionPanelProps) {
  const [fields, setFields] = useState<Field[]>([{ name: '', description: '', type: 'text' }]);
  const [showCommonFields, setShowCommonFields] = useState(false);

  const addField = () => {
    setFields([...fields, { name: '', description: '', type: 'text' }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, field: Partial<Field>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...field };
    setFields(newFields);
  };

  const addCommonField = (field: Field) => {
    setFields(prev => [...prev, { ...field }]);
    setShowCommonFields(false);
  };

  const handleSubmit = async () => {
    if (!onExtractFields) {
      console.error('onExtractFields prop is not provided');
      return;
    }

    try {
      // Validate fields
      const emptyFields = fields.filter(f => !f.name || !f.description);
      if (emptyFields.length > 0) {
        throw new Error('Please fill in all field names and descriptions');
      }

      // Create field dictionary with type information and confidence threshold
      const fieldDict = fields.reduce((acc, field) => {
        const description = `${field.description} (Type: ${field.type}, MinConfidence: 0.7)`;
        acc[field.name.trim()] = description;
        return acc;
      }, {} as { [key: string]: string });

      // Check for duplicate field names
      const uniqueFieldNames = new Set(Object.keys(fieldDict));
      if (uniqueFieldNames.size !== Object.keys(fieldDict).length) {
        throw new Error('Please ensure all field names are unique');
      }

      await onExtractFields(fieldDict);
    } catch (error) {
      console.error('Error extracting fields:', error);
      // Let the parent component handle the error toast
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Field Extraction</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCommonFields(prev => !prev)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
            >
              Common Fields
            </button>
            <button
              onClick={addField}
              className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Field
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600">Define the fields you want to extract from the processed content.</p>
      </div>

      {/* Common Fields Dropdown */}
      <AnimatePresence>
        {showCommonFields && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b"
          >
            <div className="p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Common Fields</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {commonFields.map((field, index) => (
                  <button
                    key={index}
                    onClick={() => addCommonField(field)}
                    className="p-2 bg-white rounded-md hover:bg-gray-50 transition-colors text-left flex flex-col gap-1"
                  >
                    <span className="text-sm font-medium text-gray-900">{field.name}</span>
                    <span className="text-xs text-gray-500">{field.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Fields List */}
      <div className="p-4 space-y-4">
        <AnimatePresence>
          {fields.map((field, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg relative group"
            >
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  placeholder="Field name (e.g., 'Part Number')"
                  value={field.name}
                  onChange={(e) => updateField(index, { name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <textarea
                  placeholder="Field description (e.g., 'Extract the part number from the drawing')"
                  value={field.description}
                  onChange={(e) => updateField(index, { description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(index, { type: e.target.value as Field['type'] })}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  {fieldTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              {fields.length > 1 && (
                <motion.button
                  onClick={() => removeField(index)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors absolute -right-2 -top-2 bg-white rounded-full shadow-sm border opacity-0 group-hover:opacity-100"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Field Tips */}
      <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-700">
            <p className="font-medium">Tips for better extraction:</p>
            <ul className="mt-1 list-disc list-inside space-y-1 text-blue-600">
              <li>Be specific in your field descriptions</li>
              <li>Use appropriate field types for better formatting</li>
              <li>Fields with confidence below 70% will be highlighted</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="p-4 bg-gray-50 rounded-b-lg border-t">
        <div className="space-y-4">
          {/* Field count and type indicators */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {fieldTypes.map(type => (
                <div key={type.value} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${{
                    text: 'bg-blue-500',
                    number: 'bg-green-500',
                    date: 'bg-purple-500',
                    list: 'bg-orange-500'
                  }[type.value]}`} />
                  <span className="text-gray-600">{type.label}</span>
                </div>
              ))}
            </div>
            <span className="text-gray-600">
              {fields.filter(f => f.name && f.description).length} of {fields.length} fields ready
            </span>
            {fields.length > 1 && (
              <button
                onClick={() => setFields([{ name: '', description: '', type: 'text' }])}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Submit button */}
          <motion.button
            onClick={handleSubmit}
            disabled={isLoading || fields.some(f => !f.name || !f.description)}
            className={`w-full px-4 py-2.5 text-sm font-medium text-white rounded-md transition-colors ${isLoading ? 'cursor-wait bg-blue-500' : fields.some(f => !f.name || !f.description) ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            whileHover={!isLoading && !fields.some(f => !f.name || !f.description) ? { scale: 1.01 } : {}}
            whileTap={!isLoading && !fields.some(f => !f.name || !f.description) ? { scale: 0.99 } : {}}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Extracting Fields...</span>
              </div>
            ) : fields.some(f => !f.name || !f.description) ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Fill in all fields</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Extract {fields.length} Field{fields.length === 1 ? '' : 's'}</span>
              </div>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
