const ContentArea = () => {
  return (
    <div style={{ flex: 1, backgroundColor: 'white', display: 'flex', position: 'relative' }}>
      <div style={{ 
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', color: 'var(--kc-text-secondary)',
        fontFamily: 'var(--kc-font-ui)'
      }}>
        <h1>Protótipo: WebView do Tauri irá aqui</h1>
        <p>A fase 1 está rodando perfeitamente.</p>
      </div>
    </div>
  );
};

export default ContentArea;
