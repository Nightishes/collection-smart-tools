"use client";

import { useCallback, useEffect, useState } from 'react';
import { modifyHtml } from '../../../lib/htmlModify';
import { ModifyOptions, StyleInfo } from '../types';

export function useHtmlModifier() {
  const [lastHtmlName, setLastHtmlName] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [originalHtml, setOriginalHtml] = useState<string | null>(null);
  const [modifiedHtml, setModifiedHtml] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [styleInfo, setStyleInfo] = useState<StyleInfo>({ fontColors: [], fontSizes: [] });

  const [options, setOptions] = useState<ModifyOptions>({
    bgColor: '#ffffff',
    textColor: '#000000',
    removeDataImages: false,
    fontSize: 16,
    bold: false,
    italic: false,
    underline: false
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const createPreview = (html: string) => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
  };

  const fetchHtmlContent = useCallback(async (htmlName: string) => {
    try {
      const res = await fetch(`/api/upload/html?file=${encodeURIComponent(htmlName)}`);
      if (!res.ok) throw new Error('Failed to fetch HTML');
      const text = await res.text();
      setOriginalHtml(text);
      setLastHtmlName(htmlName);
      
      const { modifiedHtml: initial, styleInfo: newStyleInfo } = modifyHtml(text, options);
      setHtmlContent(initial);
      setModifiedHtml(initial);
      createPreview(initial);
      setStyleInfo(newStyleInfo);
    } catch (err) {
      console.error('Error fetching html', err);
    }
  }, [options]);

  const updateOption = <K extends keyof ModifyOptions>(key: K, value: ModifyOptions[K]) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    
    if (originalHtml) {
      const { modifiedHtml: newHtml } = modifyHtml(originalHtml, newOptions);
      setModifiedHtml(newHtml);
      setHtmlContent(newHtml);
      createPreview(newHtml);
    }
  };

  const reset = () => {
    setLastHtmlName(null);
    setOriginalHtml(null);
    setHtmlContent(null);
    setModifiedHtml(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return {
    lastHtmlName,
    htmlContent,
    originalHtml,
    modifiedHtml,
    previewUrl,
    styleInfo,
    options,
    updateOption,
    fetchHtmlContent,
    reset
  };
}