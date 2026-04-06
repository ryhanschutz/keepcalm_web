import { Shield, ArrowRight, Star, Clock, LayoutGrid } from 'lucide-react';

const StartPage = () => {
  const favorites = [
    { title: 'Google', url: 'google.com', icon: 'G' },
    { title: 'DuckDuckGo', url: 'duckduckgo.com', icon: 'D' },
    { title: 'Wikipedia', url: 'wikipedia.org', icon: 'W' },
    { title: 'YouTube', url: 'youtube.com', icon: 'Y' },
    { title: 'GitHub', url: 'github.com', icon: 'GH' },
    { title: 'Apple', url: 'apple.com', icon: 'A' },
    { title: 'Privacy', url: 'privacy.net', icon: 'P' },
    { title: 'ChatGPT', url: 'openai.com', icon: 'AI' }
  ];

  return (
    <div style={{
      flex: 1,
      background: 'var(--kc-bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '80px 20px',
      overflowY: 'auto',
      color: 'var(--kc-text-primary)',
      fontFamily: 'var(--kc-font-ui)'
    }}>
      <div style={{ maxWidth: '800px', width: '100%', display: 'flex', flexDirection: 'column', gap: '56px' }}>
        
        {/* Favoritos Pragmáticos */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', opacity: 0.3 }}>
            <Star size={14} />
            <h2 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Favoritos</h2>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
            gap: '32px' 
          }}>
            {favorites.map((fav, i) => (
              <a 
                key={i}
                href={`https://${fav.url}`}
                onClick={(e) => e.preventDefault()}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '12px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'opacity 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                <div style={{ 
                  width: '56px', 
                  height: '56px', 
                  background: 'var(--kc-bg-active)',
                  borderRadius: 'var(--kc-radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 600,
                  border: '1px solid var(--kc-border-main)',
                  color: 'var(--kc-text-secondary)',
                  transition: 'border-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--kc-accent-primary)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--kc-border-main)'}
                >
                  {fav.icon}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.6 }}>{fav.title}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Relatório de Privacidade Nocturnal */}
        <section style={{
          background: 'var(--kc-bg-toolbar)',
          borderRadius: 'var(--kc-radius-md)',
          padding: '24px',
          border: '1px solid var(--kc-border-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
        onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--kc-text-disabled)'}
        onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--kc-border-main)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              background: 'var(--kc-bg-active)', 
              borderRadius: 'var(--kc-radius-md)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--kc-accent-primary)'
            }}>
              <Shield size={20} strokeWidth={1.5} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '2px', opacity: 0.9 }}>Relatório de Privacidade</h3>
              <p style={{ fontSize: '12px', color: 'var(--kc-text-secondary)', opacity: 0.7 }}>
                O KeepCalm impediu que <strong style={{color: 'var(--kc-text-primary)'}}>142 trackers</strong> traçassem seu perfil esta semana.
              </p>
            </div>
          </div>
          <ArrowRight size={16} style={{ opacity: 0.2 }} />
        </section>

        {/* Rodapé Sugestões Pragmático */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ 
            background: 'transparent', 
            borderRadius: 'var(--kc-radius-md)', 
            padding: '12px',
            border: '1px solid var(--kc-border-main)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            opacity: 0.5
          }}>
            <Clock size={14} />
            <span style={{ fontSize: '12px' }}>Recentes</span>
          </div>
          <div style={{ 
            background: 'transparent', 
            borderRadius: 'var(--kc-radius-md)', 
            padding: '12px',
            border: '1px solid var(--kc-border-main)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            opacity: 0.5
          }}>
            <LayoutGrid size={14} />
            <span style={{ fontSize: '12px' }}>Sugestões</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StartPage;
