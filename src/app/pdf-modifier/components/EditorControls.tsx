"use client";

import { ModifyOptions, StyleInfo } from '../types';
import styles from '../page.module.css';

type EditorControlsProps = {
  options: ModifyOptions;
  onOptionChange: <K extends keyof ModifyOptions>(key: K, value: ModifyOptions[K]) => void;
  styleInfo: StyleInfo;
  onDownloadModified: () => void;
  onDownloadOriginal: () => void;
  onDownloadPdf: () => void;
  onSave: () => void;
  onClear: () => void;
};

export function EditorControls({
  options,
  onOptionChange,
  styleInfo,
  onDownloadModified,
  onDownloadOriginal,
  onDownloadPdf,
  onSave,
  onClear
}: EditorControlsProps) {
  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          Background:
          <input 
            type="color" 
            value={options.bgColor} 
            onChange={(e) => onOptionChange('bgColor', e.target.value)} 
          />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          Text:
          <input 
            type="color" 
            value={options.textColor} 
            onChange={(e) => onOptionChange('textColor', e.target.value)} 
          />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          Font size:
          <input 
            type="number" 
            value={options.fontSize} 
            onChange={(e) => onOptionChange('fontSize', Number(e.target.value) || 0)} 
            style={{ width: 72 }} 
            min={8} 
            max={72} 
          />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input 
            type="checkbox" 
            checked={options.bold} 
            onChange={(e) => onOptionChange('bold', e.target.checked)} 
          />
          Bold
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input 
            type="checkbox" 
            checked={options.italic} 
            onChange={(e) => onOptionChange('italic', e.target.checked)} 
          />
          Italic
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input 
            type="checkbox" 
            checked={options.underline} 
            onChange={(e) => onOptionChange('underline', e.target.checked)} 
          />
          Underline
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input 
            type="checkbox" 
            checked={options.removeDataImages} 
            onChange={(e) => onOptionChange('removeDataImages', e.target.checked)} 
          />
          Remove embedded data: images (data:image/*)
        </label>
        <button onClick={onDownloadModified} style={{ marginLeft: 'auto' }}>Download modified HTML</button>
        <button onClick={onDownloadOriginal} style={{ marginLeft: 8 }}>Download original HTML</button>
        <button onClick={onDownloadPdf} style={{ marginLeft: 8 }}>Download as PDF</button>
        <button onClick={onSave} style={{ marginLeft: 8 }}>Save modified HTML</button>
        <button onClick={onClear} style={{ marginLeft: 8, border: '1px solid #f88' }}>Clear uploads</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <h3>Font Colors</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {styleInfo.fontColors.map((fc) => (
                <div key={fc.name + fc.value} style={{ 
                  padding: 8, 
                  border: '1px solid #ddd', 
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8 
                }}>
                  <span>{fc.value + fc.name}</span>
                  <div style={{ 
                    width: 20, 
                    height: 20, 
                    backgroundColor: fc.value,
                    border: '1px solid #ddd',
                    borderRadius: 4
                  }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3>Font Sizes</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {styleInfo.fontSizes.map((fs) => (
                <div key={fs.name + fs.value} style={{ 
                  padding: 8, 
                  border: '1px solid #ddd', 
                  borderRadius: 4
                }}>
                  {fs.name}: {fs.value}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}