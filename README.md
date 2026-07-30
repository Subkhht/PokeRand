# PokeRand

Pokémon roguelite con rutas procedurales, capturas, evoluciones, sistema de insignias y múltiples modos de dificultad. Basado en PokeAPI.

## Características principales

### Sistema de juego
- **Rutas procedurales**: cada partida genera una ruta única de nodos (combate, tienda, descanso, Team Rocket, Spin, PokeRand, Move, Mega, G-MAX)
- **Sistema de 3 etapas**: derrota jefes para obtener insignias. 3 insignias = victoria
- **Pokédex**: registro de Pokémon vistos y capturados, con visualización de cadenas evolutivas
- **Captura**: sistema de captura con 13 tipos de Poké Balls (incluyendo Master Ball), con fórmula basada en HP, rate de ball, estado y capture rate del Pokémon
- **Evoluciones**: automáticas por nivel, por piedras evolutivas (Fire, Water, Thunder, Leaf, Moon, Sun, Shiny, Dusk, Dawn, Ice) y por objetos evolutivos equipables (Metal Coat, King's Rock, etc.)
- **PC**: almacenamiento de Pokémon excedentes
- **Eventos aleatorios**: 7 eventos (legendario, trampa, bendición, cofre, ayuda misteriosa, comerciante, zona shiny)
- **Desafíos**: 25+ desafíos (Nuzlocke, Solo Starter, Boss Rush, Speedrun, etc.)
- **Logros**: 40+ logros desbloqueables
- **Tienda Meta**: desbloquea objetos, Poké Balls, piedras evolutivas, objetos evolutivos, mejoras y música con PokéCoins

### Dificultades
| Dificultad | Descripción |
|-----------|-------------|
| Fácil | 5 rutas por etapa, 3 etapas |
| Intermedio | 10 rutas por etapa, 3 etapas |
| Difícil | 25 rutas por etapa, 3 etapas |
| Infinite | Rutas infinitas (sin etapas) |
| COLISEUM | 8 jefes a nivel 50, eliges 6 Pokémon de tu Pokédex |

### Liga Pokémon
Al derrotar al tercer jefe, puedes optar por entrar a la Liga Pokémon: seleccionas 6 Pokémon (equipo + PC), te enfrentas a 4 jefes con niveles superiores, y al ganar obtienes una medalla 🏅

### Objetos evolutivos
12 objetos (Metal Coat, King's Rock, Dragon Scale, Up-Grade, Dubious Disc, Reaper Cloth, Protector, Electirizer, Magmarizer, Prism Scale, Sachet, Whipped Dream) que aparecen con el evento Comerciante Misterioso. Se equipan en el Pokémon y al alcanzar el nivel de evolución con el objeto equipado, el Pokémon evoluciona.

### Nodos especiales
- **Tienda**: compra objetos curativos y equipables
- **Descanso**: curar equipo o capturar Pokémon salvaje
- **Team Rocket**: combate contra reclutas, puede robarte un Pokémon
- **Spin**: ruleta con premios (3 objetos, 2 equipables, 1 piedra)
- **PokeRand**: selecciona uno de 6 Pokémon aleatorios
- **Move**: intercambia un movimiento
- **Mega/G-MAX**: encuentros especiales con Pokémon mega-evolucionados o gigamax

### Combate
- Por turnos con tipos, efectividad, STAB, estadísticas
- Sistema de estados (quemado, envenenado, paralizado, congelado, dormido, confuso)
- Estadísticas temporales (suben/bajan durante el combate, máx ±6)
- Mega-evolución y Gigamax (1 vez por combate)
- Objetos equipables (30+ con modificadores de stats)

### Progresión
- Subida de nivel (+stats) al derrotar Pokémon
- Auto-evolución al alcanzar nivel requerido
- PokéCoins por victorias y logros (desbloquean items en Tienda Meta)
- Desbloqueo de generaciones y dificultades progresivo
- Modo diario con semilla fija

## Ejecutar en local

```bash
pnpm install
pnpm dev
```

Build de producción:

```bash
pnpm build
pnpm preview
```

## Estructura clave

- `src/App.tsx`: flujo principal del juego y UI (~7300 líneas)
- `src/game/types.ts`: tipos del dominio (Pokemon, nodos, run, etc.)
- `src/game/pokeapi.ts`: cliente PokeAPI con caché en memoria
- `src/game/engine.ts`: motor de combate, escalado, ruta
- `src/game/sound.ts`: sistema de audio (música y efectos)
- `src/App.css`: estilos de la interfaz

## Notas de PokeAPI

- Necesita conexión a internet para cargar Pokémon, movimientos, sprites y datos evolutivos
- Se usa caché en memoria durante la sesión para reducir llamadas repetidas
- Si PokeAPI falla temporalmente, la UI muestra mensaje de error y permite reintentar
- Las cadenas evolutivas y sprites se obtienen directamente de los endpoints oficiales

## Stack técnico

- React 18 + TypeScript
- Vite 8
- PokeAPI (REST)
- AudioContext para música y efectos
- LocalStorage para persistencia (progresión, Pokédex, meta-progresión)
