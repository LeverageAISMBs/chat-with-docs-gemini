/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum Model {
  CHAT_WITH_DOCS = 'gemini-2.5-flash',
  VOICE_CONVERSATION = 'gemini-2.5-flash-native-audio-preview-09-2025',
  CHAT_WITH_GOOGLE_SEARCH = 'gemini-2.5-pro',
}

export enum MessageSender {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface UrlContextMetadataItem {
  retrievedUrl: string; // Changed from retrieved_url
  urlRetrievalStatus: string; // Changed from url_retrieval_status
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: Date;
  isLoading?: boolean;
  urlContext?: UrlContextMetadataItem[];
  groundingMetadata?: any;
}

export interface URLGroup {
  id: string;
  name: string;
  urls: string[];
}

export interface StoredFile {
  id: number;
  name: string;
  type: string;
  size: number;
  content: string;
  isActive: boolean;
}
