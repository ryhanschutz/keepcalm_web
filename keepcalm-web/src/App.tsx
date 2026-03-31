import React, { useEffect } from 'react';
import { WindowChrome } from './components/WindowChrome';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';
import { ContentArea } from './components/ContentArea';
import { StatusBar } from './components/StatusBar';
import { BackendListener } from './components/BackendListener';
import { NetworkSettings } from './components/NetworkSettings';
import { useTabStore } from './store/useTabStore';
import './styles/components.css';

const App: React.FC = () => {
  const { tabs, addTab } = useTabStore();

  useEffect(() => {
    // Inicializa com uma aba se não houver nenhuma
    if (tabs.length === 0) {
      addTab('about:blank');
    }
  }, [tabs.length, addTab]);

  const [isNetworkSettingsOpen, setIsNetworkSettingsOpen] = React.useState(false);

  return (
    <div className="app-container flex flex-col h-screen">
      <WindowChrome />
      <TabBar />
      <Toolbar />
      <ContentArea />
      <StatusBar onOpenNetworkSettings={() => setIsNetworkSettingsOpen(true)} />
      <BackendListener />
      <NetworkSettings 
        isOpen={isNetworkSettingsOpen} 
        onClose={() => setIsNetworkSettingsOpen(false)} 
      />
    </div>
  );
};

export default App;
