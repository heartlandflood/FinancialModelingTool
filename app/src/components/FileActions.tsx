// Buttons for downloading the Excel template and uploading an operator's
// filled-in workbook. The template is served as a static file from /public.

import { useRef } from 'react';
import { Button } from './ui';

const TEMPLATE_URL = '/Heartland_Budget_Model_Template.xlsx';

export function FileActions({ onImport }: { onImport: (file: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          // Trigger download by clicking a transient anchor.
          const a = document.createElement('a');
          a.href = TEMPLATE_URL;
          a.download = 'Heartland_Budget_Model_Template.xlsx';
          a.click();
        }}
        title="Download the Excel template for your own data"
      >
        <DownloadIcon /> Template
      </Button>

      <Button
        variant="primary"
        onClick={() => fileRef.current?.click()}
        title="Upload your filled-in Excel workbook"
      >
        <UploadIcon /> Import workbook
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          // Reset so re-uploading the same file fires onChange again.
          e.target.value = '';
        }}
      />
    </>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V4M4.5 7.5L8 4l3.5 3.5M2.5 2.5h11" />
    </svg>
  );
}
