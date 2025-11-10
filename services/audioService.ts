/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Helper function to write a string to a DataView
function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Helper function to convert Float32Array to 16-bit PCM
function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    // Convert to 16-bit integer
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

/**
 * Creates a WAV file Blob from an array of Float32Array audio chunks.
 * @param audioChunks An array of Float32Array, each representing a chunk of audio data.
 * @param sampleRate The sample rate of the audio (e.g., 24000).
 * @returns A Blob representing the WAV file.
 */
export function createWavBlob(audioChunks: Float32Array[], sampleRate: number): Blob {
  // 1. Concatenate all audio chunks into a single Float32Array
  const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const pcmData = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of audioChunks) {
    pcmData.set(chunk, offset);
    offset += chunk.length;
  }

  // 2. Create the WAV file buffer and DataView
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length * (bitsPerSample / 8);
  const fileSize = 36 + dataSize; // 36 bytes for the header fields before the data

  const buffer = new ArrayBuffer(44 + dataSize); // 44 bytes for the complete header
  const view = new DataView(buffer);

  // 3. Write the WAV header
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');
  
  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true); // Audio format (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // 4. Write the PCM data
  floatTo16BitPCM(view, 44, pcmData);

  // 5. Create and return the Blob
  return new Blob([view], { type: 'audio/wav' });
}
