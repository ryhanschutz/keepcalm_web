import React, { useState } from 'react';
import WindowChrome from './components/WindowChrome';
import TabBar from './components/TabBar';
import Toolbar from './components/Toolbar';
import ContentArea from './components/ContentArea';
import StatusBar from './components/StatusBar';

// Importando componentes pré-existentes
import { BackendListener } from './components/BackendListener';
import { NetworkSettings } from './components/NetworkSettings';

const App: React.FC = () => {
  const [isNetworkSettingsOpen, setIsNetworkSettingsOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <WindowChrome />
      <TabBar />
      <Toolbar />
      <ContentArea />
      <StatusBar />
      
      {/* Componentes invisíveis ou modais mantidos para não quebrar dependências do antigo state */}
      <BackendListener />
      <NetworkSettings 
        isOpen={isNetworkSettingsOpen} 
        onClose={() => setIsNetworkSettingsOpen(false)} 
      />
    </div>
  );
};

export default App;
