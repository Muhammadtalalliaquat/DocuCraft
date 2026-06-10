import React, { useCallback } from 'react';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  accept?: Record<string, string[]>;
}

export default function Dropzone({ onFilesAdded, accept }: DropzoneProps) {
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    onFilesAdded(files);
  }, [onFilesAdded]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div 
      onDrop={onDrop}
      onDragOver={onDragOver}
      className="border-4 border-dashed border-gray-300 rounded-3xl p-20 text-center hover:border-brand-primary transition-all cursor-pointer bg-white"
    >
      <input 
        type="file" 
        onChange={(e) => e.target.files && onFilesAdded(Array.from(e.target.files))}
        className="hidden" 
        id="file-input"
        accept={accept ? Object.keys(accept).join(',') : undefined}
      />
      <label htmlFor="file-input" className="cursor-pointer">
        <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Drag and Drop PDF here or Click to Select</p>
      </label>
    </div>
  );
}
