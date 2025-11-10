/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { Trash2, Music4 } from 'lucide-react';
import { StoredFile } from '../types';

interface AudioPlayerProps {
  file: StoredFile;
  onDelete: (id: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ file, onDelete }) => {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  useEffect(() => {
    // The content is a Base64 Data URL, e.g., "data:audio/wav;base64,..."
    // The audio element can use this directly.
    setAudioSrc(file.content);

    // No need for cleanup as we are not creating an object URL
  }, [file.content]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <Music4 size={16} className="text-[#A8ABB4] flex-shrink-0" />
          <span className="text-xs text-[#E2E2E2] truncate" title={file.name}>
            {file.name}
          </span>
        </div>
        <button 
          onClick={() => onDelete(file.id)}
          className="p-1 text-[#A8ABB4] hover:text-[#f87171] rounded-md hover:bg-[rgba(255,0,0,0.1)] transition-colors flex-shrink-0 ml-2"
          aria-label={`Remove ${file.name}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {audioSrc && (
        <audio
          controls
          src={audioSrc}
          className="w-full h-8"
          style={{ filter: 'invert(1) grayscale(1) contrast(0.8)' }}
        >
          Your browser does not support the audio element.
        </audio>
      )}
    </div>
  );
};

export default AudioPlayer;
