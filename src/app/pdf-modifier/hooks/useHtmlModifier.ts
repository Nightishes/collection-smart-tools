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
  const [fcOverrides, setFcOverrides] = useState<Record<string, string>>({});
  const [fsOverrides, setFsOverrides] = useState<Record<string, string>>({});

  const [options, setOptions] = useState<ModifyOptions>({
    bgColor: '#ffffff',
    removeDataImages: false,
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
      
      const { modifiedHtml: initial, styleInfo: newStyleInfo } = modifyHtml(text, { ...options, fcOverrides: fcOverrides, fsOverrides: fsOverrides });
      setHtmlContent(initial);
      setModifiedHtml(initial);
      createPreview(initial);
      setStyleInfo(newStyleInfo);
      // initialize overrides from discovered styleInfo if not already present
      const initialFc: Record<string, string> = {};
      newStyleInfo.fontColors.forEach((fc) => {
        initialFc[fc.name] = fc.value;
      });
      const initialFs: Record<string, string> = {};
      newStyleInfo.fontSizes.forEach((fs) => {
        initialFs[fs.name] = fs.value;
      });
      setFcOverrides((prev) => ({ ...initialFc, ...prev }));
      setFsOverrides((prev) => ({ ...initialFs, ...prev }));
    } catch (err) {
      console.error('Error fetching html', err);
    }
  }, [options, fcOverrides, fsOverrides]);

  const updateOption = <K extends keyof ModifyOptions>(key: K, value: ModifyOptions[K]) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    
    if (originalHtml) {
      const { modifiedHtml: newHtml } = modifyHtml(originalHtml, { ...newOptions, fcOverrides, fsOverrides });
      setModifiedHtml(newHtml);
      setHtmlContent(newHtml);
      createPreview(newHtml);
    }
  };

  const updateClassOverride = (kind: 'fc' | 'fs', name: string, value: string) => {
    // normalize fs numeric values to px
    if (kind === 'fs') {
      const numMatch = String(value).trim().match(/^\d+(?:\.\d+)?$/);
      if (numMatch) value = `${value}px`;
    }

    if (kind === 'fc') {
      setFcOverrides((prev) => {
        const next = { ...prev, [name]: value };
        if (originalHtml) {
          const { modifiedHtml: newHtml } = modifyHtml(originalHtml, { ...options, fcOverrides: next, fsOverrides });
          setModifiedHtml(newHtml);
          setHtmlContent(newHtml);
          createPreview(newHtml);
        }
        return next;
      });
    } else {
      setFsOverrides((prev) => {
        const next = { ...prev, [name]: value };
        if (originalHtml) {
          const { modifiedHtml: newHtml } = modifyHtml(originalHtml, { ...options, fcOverrides, fsOverrides: next });
          setModifiedHtml(newHtml);
          setHtmlContent(newHtml);
          createPreview(newHtml);
        }
        return next;
      });
    }
  };

  const resetClassOverride = (kind: 'fc' | 'fs', name: string) => {
    // reset to discovered original value from styleInfo
    if (kind === 'fc') {
      const orig = styleInfo.fontColors.find((f) => f.name === name)?.value;
      if (orig !== undefined) updateClassOverride('fc', name, orig);
    } else {
      const orig = styleInfo.fontSizes.find((f) => f.name === name)?.value;
      if (orig !== undefined) updateClassOverride('fs', name, orig);
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
    fcOverrides,
    fsOverrides,
    updateOption,
    updateClassOverride,
    resetClassOverride,
    fetchHtmlContent,
    reset
  };
}