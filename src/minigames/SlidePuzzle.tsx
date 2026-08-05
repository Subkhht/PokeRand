import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { POKEDEX, randomFrom, spriteUrl } from './pokeData'

const GAP = 6

function solvedFor(s: number): number[] {
  const arr = Array.from({ length: s * s }, (_, i) => i + 1)
  arr[s * s - 1] = 0
  return arr
}

function shuffleTiles(s: number): number[] {
  const solved = solvedFor(s)
  const t = [...solved]
  let empty = s * s - 1
  const moveCount = 60 + s * s * 15
  for (let k = 0; k < moveCount; k++) {
    const row = Math.floor(empty / s)
    const col = empty % s
    const neighbors: number[] = []
    if (row > 0) neighbors.push(empty - s)
    if (row < s - 1) neighbors.push(empty + s)
    if (col > 0) neighbors.push(empty - 1)
    if (col < s - 1) neighbors.push(empty + 1)
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)]
    t[empty] = t[pick]
    t[pick] = 0
    empty = pick
  }
  if (t.every((v, i) => v === solved[i])) return shuffleTiles(s)
  return t
}

export default function SlidePuzzle({ onComplete }: CasinoMinigameProps): JSX.Element {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const [started, setStarted] = useState(false)
  const [size, setSize] = useState(3)
  const [tiles, setTiles] = useState<number[]>([])
  const [sprite, setSprite] = useState(25)
  const [ready, setReady] = useState(false)
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [status, setStatus] = useState<'playing' | 'won'>('playing')
  const [result, setResult] = useState<number | null>(null)
  const [msg, setMsg] = useState('')

  const TILE = size === 3 ? 92 : 64

  const start = (s: number): void => {
    playClick()
    setSize(s)
    setReady(false)
    setTiles([])
    setMoves(0)
    setSeconds(0)
    setStatus('playing')
    setResult(null)
    setMsg('')
    const poke = randomFrom(POKEDEX)
    setSprite(poke.id)
    setStarted(true)
  }

  const onImgReady = (): void => {
    setReady(true)
    setTiles(shuffleTiles(size))
  }

  const reshuffle = (): void => {
    playClick()
    setTiles(shuffleTiles(size))
    setMoves(0)
    setSeconds(0)
    setStatus('playing')
    setResult(null)
    setMsg('')
  }

  useEffect(() => {
    if (!started || !ready || status !== 'playing' || result !== null) return
    const iv = window.setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)
    return () => window.clearInterval(iv)
  }, [started, ready, status, result])

  const clickTile = (pos: number): void => {
    if (!started || !ready || status !== 'playing' || result !== null) return
    const solved = solvedFor(size)
    const empty = tiles.indexOf(0)
    const er = Math.floor(empty / size)
    const ec = empty % size
    const r = Math.floor(pos / size)
    const c = pos % size
    if (Math.abs(er - r) + Math.abs(ec - c) !== 1) {
      playClick()
      return
    }
    const next = [...tiles]
    next[empty] = tiles[pos]
    next[pos] = 0
    setTiles(next)
    const nm = moves + 1
    setMoves(nm)
    if (next.every((v, i) => v === solved[i])) {
      setStatus('won')
      playEvolution()
      const score = Math.max(100, Math.min(1000, Math.round(1000 - seconds * 8 - nm * (size === 3 ? 4 : 2))))
      const used = seconds
      setTimeout(() => {
        setMsg(`Completado en ${used}s y ${nm} movimientos`)
        setResult(score)
        setTimeout(() => onCompleteRef.current(score), 900)
      }, 450)
    } else {
      playHit()
    }
  }

  const box = size * TILE + (size - 1) * GAP

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '1.25rem 1rem 1rem' }}>
      {!started ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '3rem', animation: 'casinoBounce 0.9s ease infinite' }}>🧩</div>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, maxWidth: '360px' }}>
            Ordena las fichas del Pokémon deslizándolas hasta la casilla vacía. ¡Elige tu dificultad!
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="cta" type="button" onClick={() => start(3)} style={{ background: '#34d399', color: '#0b2012' }}>
              3x3 · Fácil
            </button>
            <button className="cta" type="button" onClick={() => start(4)} style={{ background: '#f0abfc', color: '#1a1033' }}>
              4x4 · Difícil
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative', width: box, height: box }}>
              <div
                style={{
                  position: 'absolute', inset: 0, borderRadius: '14px',
                  background: 'rgba(0,0,0,0.4)', border: `3px solid ${status === 'won' ? '#34d399' : '#f0abfc'}`,
                  boxShadow: status === 'won' ? '0 0 24px rgba(52,211,153,0.6)' : 'none',
                  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                }}
              />
              {!ready ? (
                <div
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '2rem', animation: 'casinoBounce 0.8s ease infinite' }}>🎴</div>
                  <p style={{ color: '#7d7ab5', fontSize: '0.8rem', margin: 0 }}>¡Mezclando...</p>
                </div>
              ) : (
                tiles.map((v, pos) => {
                  if (v === 0) return null
                  const col = (v - 1) % size
                  const row = Math.floor((v - 1) / size)
                  const pc = pos % size
                  const pr = Math.floor(pos / size)
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => clickTile(pos)}
                      disabled={status !== 'playing' || result !== null}
                      style={{
                        position: 'absolute',
                        left: pc * (TILE + GAP),
                        top: pr * (TILE + GAP),
                        width: TILE,
                        height: TILE,
                        borderRadius: '10px',
                        border: '2px solid rgba(255,255,255,0.35)',
                        backgroundImage: `url(${spriteUrl(sprite)})`,
                        backgroundSize: `${size * 100}% ${size * 100}%`,
                        backgroundPosition: `${(col / (size - 1)) * 100}% ${(row / (size - 1)) * 100}%`,
                        imageRendering: 'pixelated',
                        cursor: status === 'playing' && result === null ? 'pointer' : 'default',
                        transition: 'left 0.18s ease, top 0.18s ease, transform 0.1s ease',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                        animation: `casinoWhackPop 0.3s ease both`,
                        animationDelay: `${pos * 0.02}s`,
                        zIndex: 1,
                      }}
                    />
                  )
                })
              )}
              {status === 'won' && result === null && (
                <div
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '12px', background: 'rgba(0,0,0,0.35)', zIndex: 2, animation: 'casinoFadeIn 0.4s ease',
                  }}
                >
                  <span style={{ fontSize: '3.5rem', animation: 'casinoBounce 0.8s ease infinite' }}>✅</span>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#7d7ab5' }}>Referencia</div>
              <div style={{ width: TILE, height: TILE, borderRadius: '10px', overflow: 'hidden', border: '2px solid #34d399' }}>
                <img src={spriteUrl(sprite)} alt="ref" style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
              </div>
              <button
                className="tiny-btn"
                type="button"
                onClick={reshuffle}
                disabled={status !== 'playing' || result !== null || !ready}
                style={{ color: '#7d7ab5' }}
              >
                🔀 Reiniciar
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '18px', color: '#cbd5e1', fontSize: '0.9rem' }}>
            <span>⏱ {seconds}s</span>
            <span>🔄 Movimientos: <strong style={{ color: '#ffcb05' }}>{moves}</strong></span>
            <span>📐 {size}x{size}</span>
          </div>
          {status === 'won' && result === null && (
            <p style={{ color: '#34d399', fontWeight: 'bold', fontSize: '1rem', margin: 0, animation: 'casinoWhackPop 0.4s ease' }}>
              🎉 {msg}
            </p>
          )}
          <img
            src={spriteUrl(sprite)}
            alt=""
            onLoad={onImgReady}
            onError={onImgReady}
            style={{ display: 'none' }}
          />
        </>
      )}
      {result !== null && (
        <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
          {result >= 800 ? '🧩 ¡Maestro del puzle!' : result >= 400 ? '🙂 ¡Buen trabajo!' : '🔄 ¡A mejorar!'} · {result} pts
        </p>
      )}
    </div>
  )
}
