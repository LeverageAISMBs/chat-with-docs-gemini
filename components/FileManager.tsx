/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import { StoredFile } from '../types';
import AudioPlayer from './AudioPlayer';

interface FileManagerProps {
  files: StoredFile[];
  onFileUpload: (file: File) => void;
  onFileToggle: (id: number, isActive: boolean) => void;
  onFileDelete: (id: number) => void;
}

const FileManager: React.FC<FileManagerProps> = ({ files, onFileUpload, onFileToggle, onFileDelete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('text/') || ['application/json', 'application/javascript', 'application/xml', 'application/markdown'].includes(file.type)) {
         onFileUpload(file);
         setError(null);
      } else {
        setError(`Unsupported file type: ${file.type}. Please upload a text-based file.`);
      }
    }
    // Reset file input to allow uploading the same file again
    if (event.target) {
        event.target.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className="h-full flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="text/*,.json,.md,.js,.ts,.html,.css,.xml"
      />
      <button
        onClick={triggerFileInput}
        className="w-full flex items-center justify-center gap-2 h-9 px-3 bg-white/[.12] hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium mb-3"
      >
        <Upload size={16} />
        Upload File
      </button>
      {error && <p className="text-xs text-[#f87171] mb-2">{error}</p>}

      <div className="flex-grow overflow-y-auto space-y-2 chat-container">
        {files.length === 0 && (
          <p className="text-[#777777] text-center py-3 text-sm">Upload files to use as context for your chat.</p>
        )}
        {files.map((file) => (
          <div key={file.id} className="p-2.5 bg-[#2C2C2C] border border-[rgba(255,255,255,0.05)] rounded-lg">
            {file.type.startsWith('audio/') ? (
              <AudioPlayer file={file} onDelete={onFileDelete} />
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                    <FileText size={16} className="text-[#A8ABB4] flex-shrink-0" />
                    <span className="text-xs text-[#E2E2E2] truncate" title={file.name}>
                        {file.name}
                    </span>
                </div>
                <div className="flex items-center flex-shrink-0 ml-2">
                    <label htmlFor={`toggle-${file.id}`} className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                id={`toggle-${file.id}`} 
                                className="sr-only" 
                                checked={file.isActive}
                                onChange={(e) => onFileToggle(file.id, e.target.checked)}
                            />
                            <div className={`block w-9 h-5 rounded-full transition ${file.isActive ? 'bg-[#79B8FF]' : 'bg-[#4A4A4A]'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${file.isActive ? 'translate-x-4' : ''}`}></div>
                        </div>
                    </label>
                    <button 
                      onClick={() => onFileDelete(file.id)}
                      className="p-1 text-[#A8ABB4] hover:text-[#f87171] rounded-md hover:bg-[rgba(255,0,0,0.1)] transition-colors ml-2"
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileManager;