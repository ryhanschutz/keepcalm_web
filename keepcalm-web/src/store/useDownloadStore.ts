import { create } from 'zustand';

export interface DownloadItem {
  id: string;
  filename: string;
  path?: string;
  progress: number; // 0 to 100
  totalSize?: number;
  downloadedSize: number;
  status: 'starting' | 'downloading' | 'finished' | 'canceled' | 'error';
  timestamp: number;
}

interface DownloadState {
  downloads: DownloadItem[];
  addDownload: (id: string, filename: string, totalSize?: number, path?: string) => void;
  updateProgress: (id: string, downloaded: number, total?: number) => void;
  finishDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  clearFinished: () => void;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  downloads: [],

  addDownload: (id, filename, totalSize, path) => set((state) => ({
    downloads: [
      {
        id,
        filename,
        path,
        progress: 0,
        totalSize,
        downloadedSize: 0,
        status: 'starting',
        timestamp: Date.now(),
      },
      ...state.downloads,
    ],
  })),

  updateProgress: (id, downloaded, total) => set((state) => ({
    downloads: state.downloads.map((d) => {
      if (d.id !== id) return d;
      const totalSize = total || d.totalSize;
      const progress = totalSize ? Math.round((downloaded / totalSize) * 100) : 0;
      return { 
        ...d, 
        downloadedSize: downloaded, 
        totalSize, 
        progress,
        status: 'downloading' 
      };
    }),
  })),

  finishDownload: (id) => set((state) => ({
    downloads: state.downloads.map((d) => 
      d.id === id ? { ...d, status: 'finished', progress: 100 } : d
    ),
  })),

  cancelDownload: (id) => set((state) => ({
    downloads: state.downloads.map((d) => 
      d.id === id ? { ...d, status: 'canceled' } : d
    ),
  })),

  clearFinished: () => set((state) => ({
    downloads: state.downloads.filter((d) => d.status !== 'finished' && d.status !== 'canceled'),
  })),
}));
