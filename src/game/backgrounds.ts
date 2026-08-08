export interface BackgroundDef {
  id: string
  name: string
  desc: string
  price: number
  icon: string
  preview: string
  opacity: number
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'none', name: 'Ninguno', desc: 'Fondo clásico, sin animación.', price: 0, icon: '⬛', preview: 'linear-gradient(135deg, #12122b 0%, #1c1c3a 100%)', opacity: 0 },
  { id: 'stars', name: 'Cielo Estrellado', desc: 'Estrellas que parpadean suavemente.', price: 30, icon: '✨', preview: 'radial-gradient(circle at 20% 20%, #2a3a6b 0%, #0b1026 100%)', opacity: 0.55 },
  { id: 'shooting', name: 'Estrellas Fugaces', desc: 'Estrellas que cruzan el cielo de vez en cuando.', price: 45, icon: '🌠', preview: 'radial-gradient(circle at 70% 20%, #2a4a8b 0%, #0a0e24 100%)', opacity: 0.55 },
  { id: 'snow', name: 'Nevada', desc: 'Copos de nieve cayendo con suave vaivén.', price: 35, icon: '❄️', preview: 'linear-gradient(160deg, #1a2a4a 0%, #3a5a8a 100%)', opacity: 0.6 },
  { id: 'rain', name: 'Lluvia Nocturna', desc: 'Lluvia fina bajo la luna.', price: 35, icon: '🌧️', preview: 'linear-gradient(180deg, #0b1226 0%, #1a2b4a 100%)', opacity: 0.5 },
  { id: 'bubbles', name: 'Burbujas', desc: 'Burbujas que suben desde el fondo.', price: 35, icon: '🫧', preview: 'linear-gradient(180deg, #062a3a 0%, #0a4a6a 100%)', opacity: 0.55 },
  { id: 'matrix', name: 'Lluvia Digital', desc: 'Código cayendo al estilo Matrix.', price: 45, icon: '💻', preview: 'linear-gradient(180deg, #001a00 0%, #003300 100%)', opacity: 0.55 },
  { id: 'neon', name: 'Cuadrícula Synthwave', desc: 'Cuadrícula retro en perspectiva.', price: 50, icon: '🌆', preview: 'linear-gradient(180deg, #1a0533 0%, #5b0a6e 60%, #ff6adb 100%)', opacity: 0.5 },
  { id: 'fire', name: 'Fuego', desc: 'Llamas ascendentes y cenizas.', price: 50, icon: '🔥', preview: 'linear-gradient(180deg, #1a0500 0%, #4a1200 70%, #8a2a00 100%)', opacity: 0.5 },
  { id: 'lava', name: 'Río de Lava', desc: 'Globos de magma brillantes.', price: 50, icon: '🌋', preview: 'linear-gradient(180deg, #1a0800 0%, #5a1a00 60%, #ff7a1a 100%)', opacity: 0.55 },
  { id: 'aurora', name: 'Aurora Boreal', desc: 'Ondas de luz verde y violeta.', price: 45, icon: '🌌', preview: 'linear-gradient(180deg, #02130f 0%, #0a2a2a 100%)', opacity: 0.5 },
  { id: 'pokeballs', name: 'Pokébolas Flotantes', desc: 'Pokébolas que derivan flotando.', price: 55, icon: '🔴', preview: 'linear-gradient(160deg, #1a0a0a 0%, #3a1520 60%, #6b1a2e 100%)', opacity: 0.45 },
  { id: 'confetti', name: 'Confeti', desc: 'Confeti de colores cayendo.', price: 40, icon: '🎉', preview: 'linear-gradient(180deg, #241a4a 0%, #3a2a6e 100%)', opacity: 0.45 },
  { id: 'ghost', name: 'Fuego Fantasma', desc: 'Llamas espectrales de color cian.', price: 45, icon: '👻', preview: 'linear-gradient(180deg, #0a0a1a 0%, #14263a 100%)', opacity: 0.55 },
  { id: 'ripples', name: 'Olas Interactivas', desc: 'Crea ondas con el movimiento del ratón y los clics.', price: 50, icon: '🌊', preview: 'linear-gradient(180deg, #001a2a 0%, #003d5a 100%)', opacity: 0.55 },
  { id: 'leaves', name: 'Hojas de Otoño', desc: 'Hojas que caen girando con el viento.', price: 40, icon: '🍂', preview: 'linear-gradient(180deg, #1a1206 0%, #3a2a12 100%)', opacity: 0.6 },
  { id: 'sakura', name: 'Pétalos de Cerezo', desc: 'Pétalos rosas cayendo suavemente.', price: 40, icon: '🌸', preview: 'linear-gradient(180deg, #2a0a1a 0%, #4a1228 100%)', opacity: 0.6 },
  { id: 'fireflies', name: 'Luciérnagas', desc: 'Puntos de luz que parpadean y flotan.', price: 45, icon: '🪲', preview: 'linear-gradient(180deg, #061a12 0%, #0a2a1a 100%)', opacity: 0.55 },
  { id: 'thunder', name: 'Tormenta', desc: 'Lluvia intensa con relámpagos.', price: 50, icon: '⛈️', preview: 'linear-gradient(180deg, #0a0f1a 0%, #18263f 100%)', opacity: 0.55 },
  { id: 'galaxy', name: 'Galaxia', desc: 'Espiral giratoria de estrellas.', price: 50, icon: '🌌', preview: 'radial-gradient(circle at 50% 50%, #2a1450 0%, #0a0620 100%)', opacity: 0.55 },
]
