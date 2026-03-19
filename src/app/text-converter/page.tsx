"use client";
import { useState, useRef } from 'react';
import styles from './page.module.css';
import { useMultiFileUpload, UploadedItem } from './hooks/useMultiFileUpload';
import { useFileConversions, TargetFormat, ConversionResult } from './hooks/useFileConversions';

type SingleTarget = 'html' | 'pdf' | 'docx' | 'odt' | 'txt';
type FormatMode = 'none' | 'preset' | 'custom';
type ViewMode = 'single' | 'multi';

interface PreviewData {
  filename: string;
  blob: string;
  previewHtml?: string;
  previewText?: string;
  target: SingleTarget;
}

export default function TextConverterPage() {
const [error, setError] = useState<string | null>(null);
const [mode, setMode] = useState<ViewMode>('single');

// Single target state
const [singleFile, setSingleFile] = useState<File | null>(null);
const [singleBusy, setSingleBusy] = useState(false);
const [singleTarget, setSingleTarget] = useState<SingleTarget>('pdf');
const [formatMode, setFormatMode] = useState<FormatMode>('none');
const [pagePreset, setPagePreset] = useState<'A5' | 'A4' | 'A3' | 'A2' | 'A1' | 'A0'>('A4');
const [customWidthMm, setCustomWidthMm] = useState('210');
const [customHeightMm, setCustomHeightMm] = useState('297');
const [preview, setPreview] = useState<PreviewData | null>(null);
const singleInputRef = useRef<HTMLInputElement | null>(null);

// Multi target state
const [isDragging, setIsDragging] = useState(false);
const multiInputRef = useRef<HTMLInputElement | null>(null);
const { items, addFiles, uploadPdf, removeItem, clearAll } = useMultiFileUpload(async () => Promise.resolve());
const { results, busyIds, convert, downloadResult, clearResultsForId } = useFileConversions();

const onMultiFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
  addFiles(e.target.files);
};

const onMultiDrop = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  setIsDragging(false);
  addFiles(e.dataTransfer.files);
};

const onMultiDragOver = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  if (!isDragging) setIsDragging(true);
};

const onMultiDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  setIsDragging(false);
};

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

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const onSingleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
  const next = e.target.files?.[0] || null;
  setSingleFile(next);
};

const runSingleConversion = async () => {
  if (!singleFile) {
    setError('Select one file first.');
    setTimeout(() => setError(null), 2500);
    return;
  }

  setSingleBusy(true);
  setError(null);
  setPreview(null);
  try {
    const formData = new FormData();
    formData.append('file', singleFile);
    formData.append('target', singleTarget);
    formData.append('formatMode', formatMode);
    if (formatMode === 'preset') {
      formData.append('pagePreset', pagePreset);
    }
    if (formatMode === 'custom') {
      formData.append('customWidthMm', customWidthMm);
      formData.append('customHeightMm', customHeightMm);
    }

    const res = await fetch('/api/convert/single-target', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Single-target conversion failed');
    }

    // Handle both JSON (preview) and direct blob responses
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json() as PreviewData;
      setPreview(data);
    } else {
      // Direct download (HTML)
      const blob = await res.blob();
      const fileBase = singleFile.name.replace(/\.[^.]+$/, '') || 'converted';
      const ext = singleTarget === 'html' ? 'html' : 'unknown';
      triggerDownload(blob, `${fileBase}.${ext}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Conversion failed';
    setError(message);
  } finally {
    setSingleBusy(false);
  }
};

const downloadFromPreview = () => {
  if (!preview) return;
  try {
    const binaryString = atob(preview.blob);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    triggerDownload(blob, preview.filename);
    setPreview(null);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    setError(message);
  }
};

const cancelPreview = () => {
  setPreview(null);
};

return (
<div className={styles.page}>
<main className={styles.main}>
<h1 className={styles.title}>Multi-file text & document converter</h1>
<div className={styles.modeSwitch}>
  <button
    type="button"
    className={`${styles.modeButton} ${mode === 'single' ? styles.modeButtonActive : ''}`}
    onClick={() => setMode('single')}
  >
    Single target conversion
  </button>
  <button
    type="button"
    className={`${styles.modeButton} ${mode === 'multi' ? styles.modeButtonActive : ''}`}
    onClick={() => setMode('multi')}
  >
    Multi-target conversion
  </button>
</div>
{error && <div style={{ color: 'var(--error,#f55)', marginTop: '1rem' }}>{error}</div>}

{mode === 'single' && (
  <section className={styles.section}>
    {preview ? (
      <div className={styles.previewSection}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Preview: {preview.filename}
        </h3>
        
        <div className={styles.previewContent}>
          {preview.target === 'txt' && preview.previewText && (
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordWrap: 'break-word',
              backgroundColor: 'var(--foreground)',
              padding: '1rem',
              borderRadius: '4px',
              maxHeight: '400px',
              overflow: 'auto',
            }}>
              {preview.previewText}
            </pre>
          )}
          
          {(preview.target === 'html' || preview.target === 'docx' || preview.target === 'odt') && preview.previewHtml && (
            <div 
              style={{
                backgroundColor: 'var(--foreground)',
                padding: '1rem',
                borderRadius: '4px',
                maxHeight: '400px',
                overflow: 'auto',
                border: '1px solid var(--border-color)',
              }}
              dangerouslySetInnerHTML={{ __html: preview.previewHtml.substring(0, 2000) }}
            />
          )}
          
          {preview.target === 'pdf' && preview.previewHtml && (
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              📄 PDF Preview: {Math.round(preview.blob.length / 1024)} KB
              <br />
              <small>Showing HTML preview of PDF content (first 2000 chars)</small>
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            className={styles.ctaButtonIframe}
            onClick={() => void downloadFromPreview()}
          >
            Download
          </button>
          <button
            type="button"
            className={styles.ctaButtonIframe}
            style={{ backgroundColor: 'var(--background)' }}
            onClick={() => void cancelPreview()}
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <>
        <div
          className={styles.uploadArea}
          onClick={() => singleInputRef.current?.click()}
        >
          <p style={{ marginBottom: '0.75rem' }}>Select one file (.txt, .docx, .odt, .html, .pdf)</p>
          <input
            ref={singleInputRef}
            type="file"
            accept=".txt,.docx,.odt,.html,.htm,.pdf"
            style={{ display: 'none' }}
            onChange={onSingleFileSelected}
          />
          {!singleFile && <small>No file selected.</small>}
          {singleFile && <small>Selected: {singleFile.name}</small>}
        </div>

        <div className={styles.singleControls}>
          <label className={styles.controlLabel}>
            Target format
            <select
              className={styles.select}
              value={singleTarget}
              onChange={(e) => setSingleTarget(e.target.value as SingleTarget)}
            >
              <option value="html">HTML</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="odt">ODT</option>
              <option value="txt">TXT</option>
            </select>
          </label>

          <label className={styles.controlLabel}>
            Formatting
            <select
              className={styles.select}
              value={formatMode}
              onChange={(e) => setFormatMode(e.target.value as FormatMode)}
            >
              <option value="none">Without formatting</option>
              <option value="preset">Preset size (A5-A0)</option>
              <option value="custom">Custom size (mm)</option>
            </select>
          </label>

          {formatMode === 'preset' && (
            <label className={styles.controlLabel}>
              Page preset
              <select
                className={styles.select}
                value={pagePreset}
                onChange={(e) => setPagePreset(e.target.value as 'A5' | 'A4' | 'A3' | 'A2' | 'A1' | 'A0')}
              >
                <option value="A5">A5</option>
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="A2">A2</option>
                <option value="A1">A1</option>
                <option value="A0">A0</option>
              </select>
            </label>
          )}

          {formatMode === 'custom' && (
            <div className={styles.customRow}>
              <label className={styles.controlLabel}>
                Width (mm)
                <input
                  className={styles.input}
                  type="number"
                  min={50}
                  value={customWidthMm}
                  onChange={(e) => setCustomWidthMm(e.target.value)}
                />
              </label>
              <label className={styles.controlLabel}>
                Height (mm)
                <input
                  className={styles.input}
                  type="number"
                  min={50}
                  value={customHeightMm}
                  onChange={(e) => setCustomHeightMm(e.target.value)}
                />
              </label>
            </div>
          )}

          <button
            className={styles.ctaButtonIframe}
            type="button"
            disabled={!singleFile || singleBusy}
            onClick={() => void runSingleConversion()}
          >
            {singleBusy ? 'Converting...' : 'Convert single file'}
          </button>
        </div>
      </>
    )}
  </section>
)}

{mode === 'multi' && (
  <>
    <div
      className={styles.uploadArea}
      onDrop={onMultiDrop}
      onDragOver={onMultiDragOver}
      onDragLeave={onMultiDragLeave}
      style={{
        borderColor: isDragging ? 'var(--text-secondary)' : undefined,
        background: isDragging ? 'var(--background-alt, #222)' : undefined,
      }}
      onClick={() => multiInputRef.current?.click()}
    >
      <p style={{ marginBottom: '0.75rem' }}>Drag & Drop documents or click to select</p>
      <input
        ref={multiInputRef}
        type="file"
        accept=".pdf,.docx,.html,.rtf,.odt,.txt,.md,.csv,.json"
        multiple
        style={{ display: 'none' }}
        onChange={onMultiFilesSelected}
      />
      {items.length === 0 && <small>No files yet.</small>}
      {items.length > 0 && <small>{items.length} file(s) selected</small>}
    </div>

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
  </>
)}
  </main>
</div>
);
}