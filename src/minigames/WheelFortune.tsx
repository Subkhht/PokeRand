import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playEvolution } from '../game/sound'
import { t } from '../game/i18n'

const SECTORS = [
  { label: '500', color: '#60a5fa', score: 500 },
  { label: '250', color: '#94a3b8', score: 250 },
  { label: '750', color: '#34d399', score: 750 },
  { label: '100', color: '#94a3b8', score: 100 },
  { label: 'JACKPOT', color: '#facc15', score: 1000 },
  { label: '100', color: '#94a3b8', score: 100 },
  { label: '750', color: '#34d399', score: 750 },
  { label: '250', color: '#94a3b8', score: 250 },
]

const SEGMENT = 360 / SECTORS.length
const CX = 130
const CY = 130
const OUTER_R = 118
const RIM_W = 12
const SEC_OUT = OUTER_R - RIM_W
const LABEL_R = 74

// Ángulo 0° = las 3 en punto, crece en sentido horario (como conic-gradient).
const polar = (r: number, angle: number): { x: number; y: number } => {
  const rad = (angle * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

const sectorPath = (start: number, end: number): string => {
  const p1 = polar(SEC_OUT, start)
  const p2 = polar(SEC_OUT, end)
  return `M ${CX} ${CY} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${SEC_OUT} ${SEC_OUT} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`
}

const starPath = (() => {
  const pts: string[] = []
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? 11 : 5
    const a = (k * 36 - 90) * Math.PI / 180
    pts.push(`${(CX + r * Math.cos(a)).toFixed(2)},${(CY + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M ${pts.join(' L ')} Z`
})()

export default function WheelFortune({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ score: number; label: string; color: string } | null>(null)
  const targetRef = useRef(0)
  const tickRef = useRef<number | null>(null)

  const spin = (): void => {
    if (spinning || result) return
    playClick()
    setSpinning(true)
    const extra = 5 * 360 + 720 + Math.random() * 1080
    const final = targetRef.current + extra
    targetRef.current = final
    setRotation(final)
    tickRef.current = window.setInterval(() => playClick(), 110)
  }

  useEffect(() => {
    if (!spinning || result) return
    const timer = window.setTimeout(() => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      playEvolution()
      const r = ((targetRef.current % 360) + 360) % 360
      // Sector que queda bajo el indicador (12 en punto = ángulo 270°).
      const normalized = ((270 - r) % 360 + 360) % 360
      const sectorIndex = Math.floor(normalized / SEGMENT) % SECTORS.length
      const sector = SECTORS[sectorIndex]
      setResult(sector)
      setSpinning(false)
      window.setTimeout(() => onComplete(sector.score), 700)
    }, 4600)
    return () => window.clearTimeout(timer)
  }, [spinning, result, onComplete])

  useEffect(() => () => {
    if (tickRef.current !== null) window.clearInterval(tickRef.current)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px', padding: '1.25rem 1rem 1rem' }}>
      <div style={{ position: 'relative', width: '264px', height: '264px' }}>
        {/* Indicador fijo */}
        <div style={{ position: 'absolute', top: '-4px', left: '50%', transform: 'translateX(-50%)', zIndex: 3, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}>
          <svg width="34" height="42" viewBox="0 0 34 42">
            <defs>
              <linearGradient id="pointerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffe066" />
                <stop offset="1" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <path d="M4 2 L30 2 L17 40 Z" fill="url(#pointerGrad)" stroke="#1a1033" strokeWidth="2" strokeLinejoin="round" />
            <path d="M9 8 L25 8 L17 34 Z" fill="#fff" opacity="0.25" />
          </svg>
        </div>

        {/* Rueda giratoria */}
        <div
          style={{
            width: '100%', height: '100%',
            transform: `rotate(${rotation}deg)`,
            transition: result ? 'none' : 'transform 4.5s cubic-bezier(0.12, 0.65, 0.2, 1)',
            filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.55))',
          }}
        >
          <svg width="264" height="264" viewBox="0 0 260 260">
            <defs>
              <linearGradient id="rimGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fde68a" />
                <stop offset="0.5" stopColor="#d97706" />
                <stop offset="1" stopColor="#fbbf24" />
              </linearGradient>
              <radialGradient id="hubGrad" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#fef3c7" />
                <stop offset="0.7" stopColor="#f59e0b" />
                <stop offset="1" stopColor="#b45309" />
              </radialGradient>
            </defs>

            {/* Llanta dorada */}
            <circle cx={CX} cy={CY} r={OUTER_R} fill="url(#rimGrad)" stroke="#78350f" strokeWidth="2" />
            <circle cx={CX} cy={CY} r={SEC_OUT + 2} fill="none" stroke="#1a1033" strokeWidth="2" />

            {/* Sectores */}
            {SECTORS.map((s, i) => (
              <path key={i} d={sectorPath(i * SEGMENT, (i + 1) * SEGMENT)} fill={s.color} stroke="#1a1033" strokeWidth="2" />
            ))}

            {/* Etiquetas */}
            {SECTORS.map((s, i) => {
              const mid = i * SEGMENT + SEGMENT / 2
              const p = polar(LABEL_R, mid)
              const rot = mid > 90 && mid < 270 ? mid + 180 : mid
              return (
                <text
                  key={`l-${i}`}
                  x={p.x}
                  y={p.y}
                  transform={`rotate(${rot} ${p.x} ${p.y})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#1a1033"
                  fontWeight="bold"
                  fontSize={s.label === 'JACKPOT' ? 11 : 13}
                  letterSpacing={s.label === 'JACKPOT' ? 1 : 0}
                >
                  {s.label}
                </text>
              )
            })}

            {/* Remaches de la llanta */}
            {SECTORS.map((_, i) => {
              const a = i * SEGMENT + SEGMENT / 2
              const p = polar(OUTER_R - RIM_W / 2, a)
              return <circle key={`b-${i}`} cx={p.x} cy={p.y} r={2.6} fill="#78350f" opacity="0.75" />
            })}

            {/* Bombillas parpadeantes mientras gira */}
            {SECTORS.map((_, i) => {
              const a = i * SEGMENT + SEGMENT / 2
              const p = polar(SEC_OUT - 2, a)
              return (
                <circle
                  key={`bulb-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={3.2}
                  className={spinning ? 'wheel-bulb' : undefined}
                  style={{ animationDelay: `${i * 0.09}s` }}
                  fill={spinning ? '#fffbe6' : '#fef3c7'}
                  stroke="#b45309"
                  strokeWidth="0.8"
                />
              )
            })}

            {/* Buje central con estrella */}
            <circle cx={CX} cy={CY} r={26} fill="url(#hubGrad)" stroke="#78350f" strokeWidth="3" />
            <circle cx={CX} cy={CY} r={18} fill="#1a1033" />
            <path d={starPath} fill="#facc15" stroke="#b45309" strokeWidth="1" />
          </svg>
        </div>
      </div>

      {!result && (
        <button className="cta" type="button" onClick={spin} disabled={spinning} style={{ background: spinning ? '#475569' : '#f0abfc', color: '#1a1033' }}>
          {spinning ? t('mg.spinning') : t('mg.wheel.spin')}
        </button>
      )}
      {result && (
        <div style={{ textAlign: 'center', animation: 'casinoMatch 0.5s ease' }}>
          <p style={{ color: result.color, fontWeight: 'bold', fontSize: '1.2rem', margin: '0 0 0.25rem', textShadow: '0 0 12px currentColor' }}>
            {result.label === 'JACKPOT' ? '🏆 ¡JACKPOT!' : `¡${result.score} puntos!`}
          </p>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0 }}>{t('mg.wheel.calculating')}</p>
        </div>
      )}
    </div>
  )
}
