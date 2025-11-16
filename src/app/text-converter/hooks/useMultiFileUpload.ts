"use client";
import { useState, useCallback } from 'react';

export interface UploadedItem {
  file: File;
  id: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
  error?: string;
  convertedHtmlName?: string; // for PDF -> HTML name
  htmlContent?: string; // stored HTML (for PDF/Docx->HTML)
  textContent?: string; // plain text extraction
  isPdf?: boolean;
  isDocx?: boolean;
}

export function useMultiFileUpload(onPdfHtmlReady: (item: UploadedItem) => Promise<void>) {
  const [items, setItems] = useState<UploadedItem[]>([]);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    const mapped: UploadedItem[] = files.map(f => ({
      file: f,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: 'idle',
      isPdf: f.name.toLowerCase().endsWith('.pdf'),
      isDocx: f.name.toLowerCase().endsWith('.docx')
    }));
    setItems(prev => [...prev, ...mapped]);
  }, []);

  const uploadPdf = useCallback(async (item: UploadedItem) => {
    if (!item.isPdf) return;
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'uploading' } : x));
    const form = new FormData();
    form.append('file', item.file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Upload failed');
      if (json.html) {
        const htmlRes = await fetch(`/api/upload/html?file=${encodeURIComponent(json.html)}`);
        if (htmlRes.ok) {
          const htmlText = await htmlRes.text();
          const updated: UploadedItem = { ...item, status: 'done', convertedHtmlName: json.html, htmlContent: htmlText, isPdf: true };
          setItems(prev => prev.map(x => x.id === item.id ? updated : x));
          await onPdfHtmlReady(updated);
          return;
        }
      }
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'done' } : x));
    } catch (err: any) {
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'error', error: err?.message || 'Upload error' } : x));
    }
  }, [onPdfHtmlReady]);

  const removeItem = (id: string) => setItems(prev => prev.filter(x => x.id !== id));
  const clearAll = () => setItems([]);

  return { items, addFiles, uploadPdf, removeItem, clearAll };
}
