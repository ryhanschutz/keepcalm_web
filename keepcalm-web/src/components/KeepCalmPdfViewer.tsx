import React from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface KeepCalmPdfViewerProps {
  url: string;
}

const KeepCalmPdfViewer: React.FC<KeepCalmPdfViewerProps> = ({ url }) => {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  return (
    <div 
      className="keepcalm-pdf-container" 
      style={{ 
        height: '100%', 
        width: '100%', 
        background: '#1e1e1f',
        position: 'absolute',
        inset: 0,
        zIndex: 50 // above start page, below toolbar/modals
      }}
    >
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
        <Viewer
          fileUrl={url}
          plugins={[defaultLayoutPluginInstance]}
          theme="dark"
        />
      </Worker>
    </div>
  );
};

export default KeepCalmPdfViewer;
