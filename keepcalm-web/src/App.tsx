import React, { useState } from 'react';
import HeaderBar from './components/HeaderBar';
import ContentArea from './components/ContentArea';
import StatusBar from './components/StatusBar';
import { BackendListener } from './components/BackendListener';
import { NetworkSettings } from './components/NetworkSettings';
import StartPage from './components/StartPage';

const App: React.FC = () => {
  const [isNetworkSettingsOpen, setIsNetworkSettingsOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(''); // Estado para controlar se exibe StartPage ou WebView

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      width: '100vw',
      background: 'var(--kc-bg-base)',
      overflow: 'hidden'
    }}>
      <HeaderBar onNavigate={(url: string) => setCurrentUrl(url)} currentUrl={currentUrl} />
      
      <main style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {currentUrl === '' ? (
          <StartPage />
        ) : (
          <ContentArea />
        )}
      </main>

      <StatusBar />
      
      {/* Componentes invisíveis ou modais */}
      <BackendListener />
      <NetworkSettings 
        isOpen={isNetworkSettingsOpen} 
        onClose={() => setIsNetworkSettingsOpen(false)} 
      />
    </div>
  );
};

export default App;
