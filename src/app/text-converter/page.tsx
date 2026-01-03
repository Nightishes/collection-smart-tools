"use client";
import { useState, useRef } from 'react';
import styles from './page.module.css';
import { useMultiFileUpload, UploadedItem } from './hooks/useMultiFileUpload';
import { useFileConversions, TargetFormat, ConversionResult } from './hooks/useFileConversions';

export default function TextConverterPage() {
const [error, setError] = useState<string | null>(null);
const [isDragging, setIsDragging] = useState(false);
const inputRef = useRef<HTMLInputElement | null>(null);
const { items, addFiles, uploadPdf, removeItem, clearAll } = useMultiFileUpload(async () => Promise.resolve());
const { results, busyIds, convert, downloadResult, clearResultsForId } = useFileConversions();

const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
addFiles(e.target.files);
};

const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
e.preventDefault();
setIsDragging(false);
addFiles(e.dataTransfer.files);
};
const onDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (!isDragging) setIsDragging(true); };
const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };

const startConversion = (itemId: string, target: TargetFormat) => {
const item: UploadedItem | undefined = items.find((i: UploadedItem) => i.id === itemId);
if (!item) return;
  if (item.status !== 'done') {
    setError('Please upload and wait for completion before converting');
    setTimeout(() => setError(null), 3000);
    return;
  }
  void convert(item, target);
};

return (
<div className={styles.page}>
<main className={styles.main}>
<h1 className={styles.title}>Multi-file text & document converter</h1>
<div
className={styles.uploadArea}
onDrop={onDrop}
onDragOver={onDragOver}
onDragLeave={onDragLeave}
style={{
borderColor: isDragging ? 'var(--text-secondary)' : undefined,
background: isDragging ? 'var(--background-alt, #222)' : undefined,
}}
onClick={() => inputRef.current?.click()}
>
<p style={{ marginBottom: '0.75rem' }}>Drag & Drop documents or click to select</p>
<input
ref={inputRef}
type="file"
accept=".pdf,.docx,.html,.rtf,.odt,.txt,.md,.csv,.json"
multiple
style={{ display: 'none' }}
onChange={onFilesSelected}
/>
{items.length === 0 && <small>No files yet.</small>}
{items.length > 0 && <small>{items.length} file(s) selected</small>}
</div>
{error && <div style={{ color: 'var(--error,#f55)', marginTop: '1rem' }}>{error}</div>}

    {items.length > 0 && (
      <section className={styles.section}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button className={styles.ctaButtonIframe} type="button" onClick={clearAll}>Clear All</button>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {items.map((item: UploadedItem) => {
            const itemResults: ConversionResult[] = results.filter((r: ConversionResult) => r.id === item.id);
            const canConvert = item.status === 'done';
            const isBusy = busyIds.includes(item.id);
            return (
              <div key={item.id} style={{ border: '1px solid var(--border-color)', padding: '0.75rem', background: 'var(--foreground)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
                  <strong>{item.file.name}</strong>
                  <div style={{ fontSize: 12 }}>
                    {item.status === 'uploading' && 'Uploading PDF…'}
                    {busyIds.includes(item.id) && item.status !== 'uploading' && 'Converting…'}
                    {item.status === 'error' && <span style={{ color:'var(--error,#f55)' }}>{item.error}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
                  {item.status !== 'done' ? (
                    <button
                      className={styles.ctaButtonIframe}
                      type="button"
                      disabled={item.status === 'uploading' || isBusy}
                      onClick={() => uploadPdf(item)}
                    >{item.status === 'uploading' ? 'Uploading…' : 'Upload file'}</button>
                  ) : (
                    <>
                      {['html','docx','txt'].map(fmt => {
                        const needsHtml = item.isPdf && fmt === 'html' && !item.htmlContent;
                        const isDisabled = isBusy || item.status === 'uploading' || item.status === 'error' || !canConvert;
                        return (
                          <button
                            key={fmt}
                            disabled={isDisabled}
                            className={styles.ctaButtonIframe}
                            type="button"
                            onClick={() => startConversion(item.id, fmt as TargetFormat)}
                            title={!canConvert ? 'Upload file before converting' : needsHtml ? 'Upload PDF first to convert to HTML' : undefined}
                          >{fmt.toUpperCase()}</button>
                        );
                      })}
                      <button
                        className={styles.ctaButtonIframe}
                        type="button"
                        disabled={busyIds.includes(item.id)}
                        onClick={() => removeItem(item.id)}
                      >Remove</button>
                    </>
                  )}
                </div>
                {canConvert && itemResults.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {itemResults.map((r: ConversionResult) => (
                      <div key={r.target} style={{ border:'1px solid var(--border-color)', padding:6 }}>
                        <span>{r.target.toUpperCase()}: </span>
                        {r.error ? (
                          <span style={{ color:'var(--error,#f55)' }}>{r.error}</span>
                        ) : (
                          <button className={styles.ctaButtonIframe} type="button" onClick={() => downloadResult(r)}>Download</button>
                        )}
                        <button style={{ marginLeft:4 }} className={styles.ctaButtonIframe} type="button" onClick={() => clearResultsForId(item.id)}>Clear Results</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    )}
  </main>
</div>
);
}