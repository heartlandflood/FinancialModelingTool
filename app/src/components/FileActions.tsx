// Header action group:
//   "Use template"   → loads the bundled .xlsx straight into state (primary CTA)
//   "Download"       → downloads the same .xlsx for offline editing
//   "Import workbook"→ uploads an operator's filled-in workbook
// The bundled template lives at /public/Heartland_Budget_Model_Template.xlsx.

import { useRef } from 'react';
import { Button } from './ui';

const TEMPLATE_URL = '/Heartland_Budget_Model_Template.xlsx';

export function FileActions({
  onImport,
  onUseTemplate,
}: {
  onImport: (file: File) => void;
  onUseTemplate: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        variant="primary"
        onClick={onUseTemplate}
        title="Populate inputs from the bundled template"
      >
        <SparkIcon /> Use template
      </Button>

      <Button
        variant="ghost"
        onClick={() => {
          const a = document.createElement('a');
          a.href = TEMPLATE_URL;
          a.download = 'Heartland_Budget_Model_Template.xlsx';
          a.click();
        }}
        title="Download the Excel template for offline editing"
      >
        <DownloadIcon /> Download
      </Button>

      <Button
        variant="ghost"
        onClick={() => fileRef.current?.click()}
        title="Upload your filled-in Excel workbook"
      >
        <UploadIcon /> Import
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.target.value = '';
        }}
      />
    </>
  );
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5l1.6 3.9L13.5 7 9.6 8.6 8 12.5 6.4 8.6 2.5 7l3.9-1.6L8 1.5z" />
      <path d="M13 12l.7 1.5 1.5.7-1.5.7L13 16.4l-.7-1.5-1.5-.7 1.5-.7.7-1.5z" />
    </svg>
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
