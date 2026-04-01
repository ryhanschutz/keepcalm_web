import React, { useEffect, useState } from 'react';
import Toolbar from './components/Toolbar';
import TabBar from './components/TabBar';
import ContentArea from './components/ContentArea';
import StatusBar from './components/StatusBar';
import { BackendListener } from './components/BackendListener';
import { NetworkSettings } from './components/NetworkSettings';
import { PrivacyPanel } from './components/PrivacyPanel';
import { useTabStore } from './store/useTabStore';

const App: React.FC = () => {
  const [isNetworkSettingsOpen, setIsNetworkSettingsOpen] = useState(false);
  const [isPrivacyPanelOpen, setIsPrivacyPanelOpen] = useState(false);
  const ensureInitialTab = useTabStore((state) => state.ensureInitialTab);

  useEffect(() => {
    void ensureInitialTab();
  }, [ensureInitialTab]);

  return (
    <div className="app-shell">
      <div className="browser-window">
        <Toolbar onTogglePrivacyPanel={() => setIsPrivacyPanelOpen((prev) => !prev)} />
        <TabBar />
        <ContentArea />
        <StatusBar />
      </div>

      <BackendListener />
      <PrivacyPanel
        isOpen={isPrivacyPanelOpen}
        onClose={() => setIsPrivacyPanelOpen(false)}
        onOpenNetworkSettings={() => setIsNetworkSettingsOpen(true)}
      />
      <NetworkSettings
        isOpen={isNetworkSettingsOpen}
        onClose={() => setIsNetworkSettingsOpen(false)}
      />
    </div>
  );
};

export default App;
