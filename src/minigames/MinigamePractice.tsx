import { useState, type JSX } from 'react'
import { CASINO_MINIGAMES } from './registry'
import MinigamePlayer from './MinigamePlayer'

interface MinigamePracticeProps {
  onClose: () => void
}

export default function MinigamePractice({ onClose }: MinigamePracticeProps): JSX.Element {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [playedMsg, setPlayedMsg] = useState(false)
  const sorted = [...CASINO_MINIGAMES].sort((a, b) => a.name.localeCompare(b.name))

  const openGame = (key: string): void => {
    setSelectedKey(key)
    setPlayedMsg(false)
  }

  const handleComplete = (): void => {
    setPlayedMsg(true)
  }

  const backToList = (): void => {
    setSelectedKey(null)
    setPlayedMsg(false)
  }

  const selected = selectedKey ? CASINO_MINIGAMES.find(g => g.key === selectedKey) : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px', maxHeight: '86vh', overflow: 'auto', padding: '0' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '3px solid var(--border-light)',
            background: 'linear-gradient(135deg, #2a1a4e 0%, #3a2a6e 45%, #1c1c3a 100%)',
            borderRadius: '3px 3px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <span style={{ fontSize: '2.2rem', filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.5))' }}>🎮</span>
            <div>
              <h2 style={{ margin: 0, color: '#f0abfc', fontSize: '1.05rem', fontFamily: 'var(--font-title)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Minijuegos
              </h2>
              <div style={{ color: '#9b98cf', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                Modo Práctica · {sorted.length} juegos
              </div>
            </div>
          </div>
          <button className="tiny-btn" type="button" onClick={onClose} style={{ fontSize: '0.9rem', padding: '4px 10px' }}>
            ✕
          </button>
        </div>

        {selectedKey === null ? (
          <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
            <p style={{ color: '#7d7ab5', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              Practica los minijuegos del Casino las veces que quieras. No ganas ni pierdes nada.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.75rem' }}>
              {sorted.map((g, i) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => openGame(g.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    textAlign: 'left',
                    background: 'var(--bg-dark)',
                    color: 'var(--text-main)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    padding: '0.7rem',
                    boxShadow: 'var(--shadow-hard-sm)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-blue)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-light)'
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = 'var(--shadow-hard-sm)'
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.4rem',
                      width: '42px',
                      height: '42px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: i % 2 === 0 ? 'rgba(240,171,252,0.15)' : 'rgba(77,155,255,0.15)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px',
                    }}
                  >
                    {g.name.split(' ')[0]}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{g.name}</span>
                    <span style={{ display: 'block', color: '#7d7ab5', fontSize: '0.72rem', lineHeight: '1.35' }}>{g.desc}</span>
                  </span>
                  <span style={{ color: 'var(--accent-blue)', fontSize: '1rem', flexShrink: 0 }}>▶</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
            <button className="tiny-btn" type="button" onClick={backToList} style={{ marginBottom: '0.75rem', color: '#7d7ab5' }}>
              ← Volver a la lista
            </button>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2rem' }}>{selected?.name.split(' ')[0]}</div>
              <p style={{ color: '#f0abfc', fontWeight: 'bold', fontSize: '1rem', margin: '0.25rem 0 0' }}>{selected?.name}</p>
              <p style={{ color: '#7d7ab5', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>Modo práctica · sin premio</p>
            </div>
            <MinigamePlayer key={selectedKey} gameKey={selectedKey} onComplete={handleComplete} />
            {playedMsg && (
              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                <p style={{ color: '#34d399', fontSize: '0.9rem', margin: 0 }}>✅ Práctica completada</p>
                <button className="secondary" type="button" onClick={backToList} style={{ marginTop: '0.5rem' }}>
                  🎮 Jugar otro
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
