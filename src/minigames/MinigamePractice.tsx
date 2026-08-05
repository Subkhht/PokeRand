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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px', maxHeight: '86vh', overflow: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ color: '#f0abfc', margin: 0 }}>🎮 Minijuegos</h2>
          <button className="tiny-btn" type="button" onClick={onClose}>✕</button>
        </div>

        {selectedKey === null ? (
          <>
            <p style={{ color: '#7d7ab5', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Practica los minijuegos del Casino las veces que quieras. No ganas ni pierdes nada.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              {sorted.map(g => (
                <button
                  key={g.key}
                  className="tiny-btn"
                  type="button"
                  onClick={() => openGame(g.key)}
                  style={{ textAlign: 'left', padding: '0.65rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span style={{ fontSize: '1.2rem' }}>{g.name.split(' ')[0]}</span>
                  <span>
                    <span style={{ display: 'block', color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{g.name}</span>
                    <span style={{ display: 'block', color: '#7d7ab5', fontSize: '0.72rem' }}>{g.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="tiny-btn" type="button" onClick={backToList} style={{ marginBottom: '0.5rem', color: '#7d7ab5' }}>
              ← Volver a la lista
            </button>
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <p style={{ color: '#f0abfc', fontWeight: 'bold', fontSize: '0.95rem', margin: 0 }}>
                {CASINO_MINIGAMES.find(g => g.key === selectedKey)?.name}
              </p>
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
          </>
        )}
      </div>
    </div>
  )
}
