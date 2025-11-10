"use client";

import { useRef } from 'react';
import { useFileUpload } from './hooks/useFileUpload';
import { useHtmlModifier } from './hooks/useHtmlModifier';
import { UploadArea, FileList } from './components/UploadComponents';
import { EditorControls } from './components/EditorControls';
import styles from "./page.module.css";

export default function PageModifyHtml() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    lastHtmlName,
    htmlContent,
    modifiedHtml,
    previewUrl,
    styleInfo,
    options,
    updateOption,
    fetchHtmlContent,
    reset
  } = useHtmlModifier();

  const { files, onFilesSelected, clearFiles } = useFileUpload(fetchHtmlContent);

  const downloadModified = async () => {
    if (!modifiedHtml) return;
    const blob = new Blob([modifiedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = lastHtmlName ? `modified-${lastHtmlName}` : 'converted.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadOriginal = async () => {
    if (!lastHtmlName) return;
    try {
      const res = await fetch(`/api/upload/html?file=${encodeURIComponent(lastHtmlName)}`);
      if (!res.ok) throw new Error('Failed to fetch HTML');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = lastHtmlName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const downloadAsPdf = async () => {
    if (!modifiedHtml) return;
    try {
      const res = await fetch('/api/upload/html/convert-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: modifiedHtml }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error('Conversion failed: ' + errText);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = lastHtmlName ? `${lastHtmlName.replace(/\.html$/i, '')}-converted.pdf` : 'converted.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('PDF conversion/download failed', err);
      alert('PDF conversion failed: ' + (err?.message || err));
    }
  };

  const saveModified = async () => {
    if (!lastHtmlName) return;
    try {
      const res = await fetch('/api/upload/html/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: lastHtmlName, options }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchHtmlContent(json.filename);
        alert('Modified HTML saved as ' + json.filename);
      } else {
        alert('Save failed: ' + (json.error || 'unknown'));
      }
    } catch (err) {
      console.error('Save error', err);
      alert('Save failed');
    }
  };

  const clearUploads = async () => {
    if (!confirm('Delete all files in uploads/? This cannot be undone. Continue?')) return;
    try {
      const res = await fetch('/api/upload/clear', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        clearFiles();
        reset();
        alert('Cleared uploads. Removed: ' + (json.removed?.length ?? 0) + ' items.');
      } else {
        alert('Clear failed: ' + (json.error || 'unknown'));
      }
    } catch (err) {
      console.error('Clear uploads failed', err);
      alert('Clear failed');
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Wanna modify your .pdf ?</h1>

        <UploadArea onFilesSelected={onFilesSelected} inputRef={inputRef} />
        <FileList files={files} />

        {htmlContent && (
          <section className={styles.section}>
            <EditorControls
              options={options}
              onOptionChange={updateOption}
              styleInfo={styleInfo}
              onDownloadModified={downloadModified}
              onDownloadOriginal={downloadOriginal}
              onDownloadPdf={downloadAsPdf}
              onSave={saveModified}
              onClear={clearUploads}
            />

            <div style={{ border: '1px solid #ddd', height: 480 }}>
              {previewUrl && (
                <iframe 
                  title="preview" 
                  src={previewUrl} 
                  style={{ width: '100%', height: '100%', border: 0 }} 
                />
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
