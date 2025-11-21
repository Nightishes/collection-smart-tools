"use client";

import { useRef } from 'react';
import { useFileUpload } from './hooks/useFileUpload';
import { useHtmlModifier } from './hooks/useHtmlModifier';
import { UploadArea, FileList } from './components/UploadComponents';
import { EditorControls } from './components/EditorControls';
import { useAuth } from '../context/AuthContext';
import styles from "./page.module.css";

export default function PageModifyHtml() {
  const { isAdmin } = useAuth();
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
    reset,
    fcOverrides,
    fsOverrides,
    updateClassOverride,
    resetClassOverride
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('PDF conversion/download failed', err);
      alert('PDF conversion failed: ' + errorMessage);
    }
  };

  const downloadAsDocx = async () => {
    if (!modifiedHtml) return;
    try {
      const res = await fetch('/api/convert/html-to-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: modifiedHtml, filename: lastHtmlName ? lastHtmlName.replace(/\.html$/i,'-converted') : 'converted' })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error('DOCX conversion failed: ' + errText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = lastHtmlName ? `${lastHtmlName.replace(/\.html$/i,'')}-converted.docx` : 'converted.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('DOCX conversion/download failed', err);
      alert('DOCX conversion failed: ' + errorMessage);
    }
  };

  const downloadOriginalPdfAsDocx = async () => {
    const originalPdfEntry = files.find(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!originalPdfEntry) {
      alert('No original PDF file found. Upload a PDF first.');
      return;
    }
    try {
      const safeName = encodeURIComponent(originalPdfEntry.name);
      const resPdf = await fetch(`/api/upload/pdf?file=${safeName}`);
      if (!resPdf.ok) throw new Error('Unable to fetch original PDF');
      const pdfBlob = await resPdf.blob();
      const form = new FormData();
      form.append('file', pdfBlob, originalPdfEntry.name);
      const res = await fetch('/api/convert/pdf-to-docx', { method: 'POST', body: form });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      const docxBlob = await res.blob();
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalPdfEntry.name.replace(/\.pdf$/i, '') + '-original.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Original PDF → DOCX failed', err);
      alert('Original PDF → DOCX failed: ' + errorMessage);
    }
  };

  const saveModified = async () => {
    if (!lastHtmlName) return;
    try {
      const res = await fetch('/api/upload/html/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: lastHtmlName, options: { ...options, fcOverrides, fsOverrides } }),
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
              fcOverrides={fcOverrides}
              fsOverrides={fsOverrides}
              onClassOverrideChange={updateClassOverride}
              onClassOverrideReset={resetClassOverride}
              onDownloadModified={downloadModified}
              onDownloadOriginal={downloadOriginal}
              onDownloadPdf={downloadAsPdf}
              onDownloadDocx={downloadAsDocx}
              onDownloadPdfDocx={downloadOriginalPdfAsDocx}
              onSave={saveModified}
              onClear={clearUploads}
              isAdmin={isAdmin}
            />

            <div style={{ border: '1px solid #ddd', height: 480, backgroundColor: '#fafafa' }}>
              {previewUrl ? (
                <iframe 
                  title="preview" 
                  src={previewUrl} 
                  style={{ width: '100%', height: '100%', border: 0, backgroundColor: 'white' }} 
                  onError={(e) => console.error('Iframe load error:', e)}
                />
              ) : (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100%', 
                  color: '#666',
                  fontSize: '14px'
                }}>
                  Upload a PDF file to see the preview
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
