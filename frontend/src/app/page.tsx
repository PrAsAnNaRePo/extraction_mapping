'use client';

import { useState } from 'react';
import axios from 'axios';
import ImageAnnotator from '@/components/ImageAnnotator';
import TextSidebar from '@/components/TextSidebar';
import { OCRResponse, TextLine } from '@/types/ocr';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [textLines, setTextLines] = useState<TextLine[]>([]);
  const [selectedBox, setSelectedBox] = useState<TextLine>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImageUrl(URL.createObjectURL(file));
      setTextLines([]);
      setSelectedBox(undefined);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post<OCRResponse>(
        'http://localhost:3002/ocr',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setTextLines(response.data.results[0].text_lines);
    } catch (err) {
      setError('Failed to process image. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBoxClick = (textLine: TextLine) => {
    setSelectedBox(textLine);
  };

  return (
    <main className="flex flex-col h-screen">
      {/* Fixed Header */}
      <div className="p-8 bg-white border-b">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Engineering Drawing OCR</h1>
          <div className="flex gap-4 items-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isLoading ? 'Processing...' : 'Process Image'}
            </button>
          </div>
          {error && (
            <div className="text-red-500 bg-red-50 p-3 rounded">{error}</div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Image Section - Fixed */}
        <div className="flex-1 p-8 overflow-hidden">
          {imageUrl && (
            <div className="h-full flex items-center justify-center">
              <ImageAnnotator
                imageUrl={imageUrl}
                textLines={textLines}
                onBoxClick={handleBoxClick}
                selectedBox={selectedBox}
              />
            </div>
          )}
        </div>

        {/* Sidebar - Scrollable */}
        <div className="w-96 border-l flex-shrink-0 overflow-hidden">
          <TextSidebar
            textLines={textLines}
            onTextClick={handleBoxClick}
            selectedText={selectedBox}
          />
        </div>
      </div>
    </main>
  );
}