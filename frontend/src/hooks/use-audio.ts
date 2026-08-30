"use client";

import { useCallback, useRef } from "react";

export type AudioToneType = "success" | "warning" | "error";

// Helper to write ASCII strings to DataView
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Generate a synthetic WAV file in-memory and return it as a Base64 Data URI
function generateSyntheticWavURI(type: AudioToneType): string {
  const sampleRate = 44100;
  const duration = type === "success" ? 0.3 : (type === "warning" ? 0.5 : 0.4);
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Generate waveform math
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Linear fade out envelope to prevent popping
    const envelope = Math.max(0, 1 - (i / numSamples));
    
    if (type === "success") {
      // Dual high-pitch chime (sine)
      const freq = t < 0.1 ? 800 : 1200;
      sample = Math.sin(2 * Math.PI * freq * t);
    } else if (type === "warning") {
      // Mid-pitch alert (triangle)
      sample = Math.sin(2 * Math.PI * 400 * t);
      sample = (2 / Math.PI) * Math.asin(sample); 
    } else if (type === "error") {
      // Low-pitch buzz (sawtooth-ish)
      const freq = 150 - (20 * t);
      sample = (t * freq % 1) * 2 - 1;
    }
    
    // Apply envelope and scale to 16-bit integer
    const intSample = Math.max(-1, Math.min(1, sample * envelope)) * 32767;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }
  
  // Convert ArrayBuffer to Base64 String safely
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunking to avoid call stack size exceeded on large arrays
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  
  return 'data:audio/wav;base64,' + btoa(binary);
}

export function useAudio() {
  // Cache the generated URIs so we don't recalculate math on every click
  const cacheRef = useRef<Record<string, string>>({});

  const playTone = useCallback((type: AudioToneType, volume: number = 50, isEnabled: boolean = true) => {
    if (!isEnabled || volume <= 0) return;

    try {
      if (!cacheRef.current[type]) {
        cacheRef.current[type] = generateSyntheticWavURI(type);
      }
      
      const audio = new Audio(cacheRef.current[type]);
      // Normalize volume to 0.0 - 1.0 for HTMLAudioElement
      audio.volume = Math.max(0, Math.min(100, volume)) / 100.0;
      audio.play().catch(console.error);

    } catch (err) {
      console.warn("Failed to play audio tone:", err);
    }
  }, []);

  return { playTone };
}
