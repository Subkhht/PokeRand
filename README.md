# PokeRand

MVP de simulador Pokemon tipo roguelite, inspirado en mezcla de roulette + progresion por run.

## Estado actual del MVP

- Configuracion de run por generacion (1-9) y modo (Classic/Nuzlocke).
- Roulette inicial desde PokeAPI: Pokemon inicial + item + modificador global.
- Ruta de 10 nodos: combates, descansos, tiendas y jefe final.
- Rivales generados desde PokeAPI por generacion, con escalado por progreso.
- Combate por turnos con tipos, dano, velocidad y pociones.
- Progresion simple tras victorias (subida de nivel y stats).
- Registro local de victorias/derrotas en LocalStorage.

## Ejecutar en local

```bash
pnpm install
pnpm dev
```

Build de produccion:

```bash
pnpm build
pnpm preview
```

## Estructura clave

- `src/App.tsx`: flujo principal del juego y UI.
- `src/game/types.ts`: tipos del dominio (Pokemon, nodos, run).
- `src/game/data.ts`: items y modificadores de run.
- `src/game/pokeapi.ts`: cliente PokeAPI con cache en memoria.
- `src/game/engine.ts`: motor de combate, escalado y route.

## Notas de PokeAPI

- Necesita conexion a internet para cargar Pokemon y movimientos.
- Se usa cache en memoria durante la sesion para reducir llamadas repetidas.
- Si PokeAPI falla temporalmente, la UI muestra mensaje de error y permite reintentar.

## Siguientes mejoras sugeridas

- Equipo de 6 Pokemon con cambios en combate.
- Capturas por nodo con reglas Nuzlocke reales.
- Eventos aleatorios y tienda con economia completa.
- Integracion con PokeAPI para ampliar roster y moves.
- Guardado cloud y ranking diario.
