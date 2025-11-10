/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { StoredFile } from '../types';

const DB_NAME = 'GeminiChatWithDocsDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let db: IDBDatabase;

// Function to initialize the database
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening IndexedDB.');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

// Function to save a file to the database
export const saveFile = async (file: Omit<StoredFile, 'id'>): Promise<StoredFile> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(file);

    request.onsuccess = () => {
      const addedFile: StoredFile = { ...file, id: request.result as number };
      resolve(addedFile);
    };

    request.onerror = () => {
      console.error('Error saving file:', request.error);
      reject('Could not save the file.');
    };
  });
};

// Function to get all files from the database
export const getFiles = async (): Promise<StoredFile[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Error getting files:', request.error);
      reject('Could not retrieve files.');
    };
  });
};

// Function to update a file
export const updateFile = async (file: StoredFile): Promise<StoredFile> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(file);

        request.onsuccess = () => {
            // FIX: The result of a 'put' operation is the key, not the stored object.
            // The function should resolve with the `StoredFile` object that was updated.
            resolve(file);
        };

        request.onerror = () => {
            console.error('Error updating file:', request.error);
            reject('Could not update the file.');
        };
    });
};


// Function to delete a file from the database
export const deleteFile = async (id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      console.error('Error deleting file:', request.error);
      reject('Could not delete the file.');
    };
  });
};