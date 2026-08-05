# PokeRand 🎲

**Pokémon roguelite** con rutas procedurales, capturas, evoluciones, insignias, minijuegos, PvP y un montón de modos. Cada partida genera una ruta única de nodos por los que avanzas combatiendo, comprando, capturando y desbloqueando contenido. Basado en **PokeAPI** (React + TypeScript + Vite).

---

## 🚀 Empezar a jugar

1. **Elige generación**: Kanto (1) a Paldea (9), o el modo **🎲 RANDOM** (mezcla todas las generaciones). Cada generación se desbloquea pasando la anterior en Intermedio.
2. **Elige dificultad**: Fácil, Intermedia, Difícil, Infinite o COLISEUM.
3. **Elige desafíos** (opcional): Nuzlocke, Solo Starter, etc.
4. Pulsa **Iniciar Aventura** y recorre la ruta nodo a nodo.

La partida se divide en **3 etapas**; al derrotar a cada jefe final ganas una **insignia**. Con 3 insignias accedes a la **Liga Pokémon**, y al vencerla completas la generación.

---

## 🗺️ La ruta y sus nodos

Cada ruta es una línea de nodos (combates, tiendas, descansos, etc.). El tipo de nodo y sus apariciones dependen de la dificultad y de lo que tengas desbloqueado en la tienda meta.

| Nodo | Qué hace |
|------|----------|
| **Combate** | Encuentro salvaje (50%) o entrenador (50%). |
| **Jefe** | Entrenador fuerte al final de cada etapa. Da una insignia. |
| **Rival** | Tu rival recurrente, aparece cada ~6 nodos. Escala contigo y da más dinero. |
| **TeamR** | Combate contra un recluta del Team Rocket; si pierdes, puede robarte un Pokémon. |
| **Tienda / Pokémart** | Compra objetos curativos, pasivos y Poké Balls. |
| **Descanso** | Curar todo el equipo o capturar un Pokémon salvaje. |
| **Spin** | Ruleta con premios (objetos, pasivos y piedras). |
| **PokeRand** | Elige 1 de 6 Pokémon aleatorios. |
| **Move** | Enseña a tu Pokémon activo un movimiento nuevo (elige 1 de 2). |
| **Mega / G-MAX / Primal** | Encuentros especiales (Hard/Infinite) que otorgan Mega Piedra, Banda Dynamax o Prismas. |
| **Casino** | Minijuego al azar con recompensas según tu puntuación. |
| **Intercambio / Mercado Negro** | Cambiar Pokémon con el Comerciante o comprar/vender a buen precio. |
| **Combate Doble** | Batalla 2v2. |

---

## ⚔️ Combate

- Sistema **por turnos** con tipos, efectividad (`getTypeEffectiveness`) y **STAB** (mismo tipo → +50% daño).
- **Estados**: quemado, envenenado, paralizado, congelado, dormido y confuso, con efectos por turno.
- **Etapas de stats**: Ataque, Defensa, At. Esp., Def. Esp. y Velocidad suben/bajan durante el combate (máx **±6**, el multiplicador se bloquea a 4x). Se **resetean al terminar cada combate**.
- **Críticos**, recoil (daño de retroceso), drenaje, robo de vida (lifesteal) y movimientos de protección.
- **Mega-evolución**, **Gigamax** y **Primal Reversion**: 1 vez por combate, con objetos equipables (Mega Stone, Dynamax Band, Prisma Rojo/Azul).
- **Objetos pasivos**: 30+ objetos equipables que modifican stats (% ataque, defensa, velocidad, crítico, robo de vida, curación por turno, etc.).

---

## 🏐 Captura

Sistema de captura por turnos basado en el HP restante, el ratio de la ball, los estados y el `capture_rate` de la especie.

**Poké Balls** (16): Poké, Great, Ultra, Master (captura automática), Quick (x5 turno 1), Timer (crece con los turnos), Dusk (x3), Net (Agua/Bicho x3), Level, Repeat (x3.5 capturado), Love (x8 misma familia), Friend, Heavy (contra pesados), **Luxury (x1.2)**, **Premier (x1)** y **Fast (x4 vs velocidad ≥100)**.

---

## ✨ Evoluciones

- **Por nivel**: auto-evolución al alcanzar el nivel de evolución.
- **Por piedras** (10): Fire, Water, Thunder, Leaf, Moon, Sun, Shiny, Dusk, Dawn, Ice. Se usan desde el inventario.
- **Por objeto equipado**: algunos Pokémon evolucionan al subir de nivel sosteniendo un objeto:
  Metal Coat, King's Rock, Dragon Scale, Up-Grade, Dubious Disc, Reaper Cloth, Protector, Electirizer, Magmarizer, Prism Scale, Sachet, Whipped Dream, Gorra de Ash, Auspicious Armor, Malicious Armor, **Razor Claw, Razor Fang, Oval Stone, Deep Sea Tooth y Deep Sea Scale** (los objetos aparecen con el Comerciante Misterioso).
  > Por ejemplo: Clamperl → **Huntail** con Deep Sea Tooth, o → **Gorebyss** con Deep Sea Scale.

---

## 🏅 Insignias y Liga

- Derrota a un jefe → obtienes una insignia (hay 32, una por generación de gimnasios).
- Con **3 insignias** se abre la **Liga Pokémon**: 4 jefes a niveles superiores. Ganarla completa el modo y da la medalla 🏅.
- Completar cada generación desbloquea la siguiente y, según dificultad, el modo **Difícil** e **Infinite**.

---

## 🧪 Objetos

### Consumibles
- **Curación**: Potion, Super/Hyper/Full Restore, Oran/Lum Berry, Elixir/Super/Full Elixir, Moomoo Milk, Berry Juice, Fresh Water, Soda Pop, Lemonade, Revive/Max Revive.
- **Potenciadores permanentes**: X Attack/Defense/Speed (1 y 2), y las **Vitaminas** (+15): Proteína (Atq), Calcio (At. Esp.), Hierro (Def), Zinc (Def. Esp.), Carburante (Vel).
- **Sacred Ash**: revive a todo el equipo con HP completo.
- **Disco MT**: enseña un movimiento a tu Pokémon activo (igual que el nodo Move), consumible. Se desbloquea y aparece en tiendas desde el PokéShop.
- **Cuerda Huida**: escapa de combates (no contra jefes).

### Pasivos (equipables)
Muscle Band, Wise Glasses, Choice Band, Leftovers, Focus Sash, Assault Vest, Quick Claw, Eviolite, Life Orb, Rocky Helmet, Scope Lens, Shell Bell, Choice Scarf, Babiri Berry, Big Root, Wide Lens, Sitrus Berry, Guts Band, Vest Protector, Focus Band, Dragon Fang, Guardian Charm, Berserker Band, Phantom Cloak, Swift Feather, Iron Ball, Vampire Fang, Cursed Blade, y las versiones **II** mejoradas (requieren comprar la versión base en el PokéShop).

---

## 🎰 Minijuegos (Casino)

El nodo Casino elige un minijuego al azar; según la puntuación obtienes mejor o peor recompensa (hasta JACKPOT). Son 20 minijuegos: Rueda de la Fortuna, Catapulta, Tiro al Blanco, Secuencia de Luces, Memoria, Reflejos, Dados, Tragamonedas, Adivina el Número, ¿Quién es ese Pokémon?, Lanza la Poké Ball, Pachinko, Adivina el Tipo, Trivia, Pesca, Atrapa Monedas, Voltorb Flip, **Puzle Deslizante**, Adivina la Pokédex, y más. Se pueden practicar gratis desde el menú **Minijuegos**.

---

## 🎯 Desafíos de run (opcionales)

Sin tiendas, Sin descansos, Todos Shiny, Solo TeamR, Nuzlocke, Solo Starter, Equipo fijo, Sin evolución, Sin objetos en batalla, Solo 2 movimientos, Primer golpe, Nivel fijo, Sin críticos, Tipo randomizado, Sin compras, Ruta ciega, Boss Rush, Speedrun, Sin dinero, Modificadores dobles, Enemigos reforzados, Sin curación, Ironman, Randomizer total, Nuzlocke hardcore, Gauntlet (3 al azar) y Egglocke.

---

## 🎲 Modificadores de run

Cada partida (y el desafío diario) aplica un modificador aleatorio que cambia las reglas: Tempestad Feroz (+ATK rival, +dinero), Mercado en Oferta (descuentos), Ruta Equilibrada (+curación), Furia del Rival, Escudo Natural, Velocidad Extrema, Codicia (+dinero, +ATK rival), etc. El desafío *Modificadores dobles* aplica dos.

---

## 🪙 Tienda Meta (PokéShop)

Con las **PokéCoins** ganadas por victorias y logros puedes desbloquear contenido permanente (una vez comprado, se guarda):

- **🎨 Temas visuales**: 27 temas de colores (Oscuro, Neón, Matrix, Galaxia, Vaporwave, Dorado, Tóxico, Samurái, Pastel, Tropical…).
- **🖼️ Fondos animados**: 15 fondos en canvas (Estrellas, Lluvia Digital, Fuego, Lava, Aurora, Pokébolas, **Olas interactivas**…), con **previsualización en vivo** en la tienda.
- **🎵 Música**: pistas de menú y batalla.
- **🧪 Items curativos / 🏐 Poké Balls / 💎 Piedras / 🔧 Evolutivos / ⚔️ Pasivos**: desbloquean su aparición en tiendas, drops y eventos.
- **💿 Disco MT** y **Vitaminas**.
- **⚙️ Mejoras**: empezar con dinero/objetos extra, rerolls de tienda, y desbloquear nodos especiales (Mega, G-MAX, Primal, Casino) en Hard/Infinite.
- Barra de **búsqueda** para encontrar objetos rápido.

---

## ♾️ Modo Infinite

Rutas **infinitas** sin etapas: cada vez que completas 5 nodos se generan 5 más. Escala contigo sin fin y registra tu progreso en el **ranking mundial**. La dificultad usa la media entre el nivel máximo y el promedio de tu equipo, con pools de Pokémon y multiplicadores propios.

---

## 👑 COLISEUM

Eliges 6 Pokémon y te enfrentas a 8 jefes a nivel 50. Se desbloquea al completar todas las generaciones en Intermedio.

---

## 🌐 Modos online (requieren Supabase)

### PvP (1v1)
Batallas en tiempo real contra otros jugadores con **ranking Elo**. Necesita cuenta (usuario + email + contraseña) y el esquema de Supabase.

### Co-op (2 jugadores)
Ruta compartida (misma semilla) donde ambos juegan sus propios encuentros, pueden **intercambiar** Pokémon y objetos, y escribir en **chat**. Victoria al derrotar al jefe final juntos.

### Ranking Infinite
El modo Infinite sube tu puntuación (nodo alcanzado + tiempo) al ranking mundial de Supabase.

---

## 📅 Desafío diario

Cada día hay una run con semilla fija (misma generación, dificultad y modificador para todos). Un intento por día; completarla da PokéCoins extra.

---

## 🏆 Logros y progresión

- **40+ logros** con recompensas en PokéCoins (capturar legendarios, rachas, desafíos...).
- **Pokédex**: registro de vistos/capturados con cadenas evolutivas.
- **Rachas** de victorias y estadísticas de run.

---

## 💾 Guardado

Todo se guarda en **LocalStorage**: progresión por generación, Pokédex, meta-progresión del PokéShop (temas, fondos, items desbloqueados, PokéCoins), ajustes y rachas.

---

## 🛠️ Configuración y desarrollo

### Requisitos
- Node.js + **pnpm** (el proyecto usa pnpm).

### Instalar y ejecutar
```bash
pnpm install
pnpm dev
```

Build de producción:
```bash
pnpm build
pnpm preview
```

---

## 📁 Estructura clave

```
src/
├── App.tsx                  # Flujo principal del juego y UI
├── BackgroundLayer.tsx      # Fondo animado a pantalla completa
├── BackgroundPreview.tsx    # Miniaturas animadas (tienda meta)
├── App.css                  # Estilos de la interfaz
├── game/
│   ├── types.ts             # Tipos del dominio (Pokemon, nodos, run, desafíos…)
│   ├── pokeapi.ts           # Cliente PokeAPI con caché en memoria
│   ├── engine.ts            # Motor de combate, escalado, modificadores y rutas
│   ├── pvpBattle.ts         # Resolución de turnos PvP
│   ├── pvp.ts / coop.ts     # Clientes Supabase (PvP y Co-op)
│   ├── leaderboard.ts       # Ranking mundial (Supabase)
│   ├── sound.ts             # Audio (música y efectos) con AudioContext
│   ├── backgrounds.ts       # Definiciones de fondos animados
│   └── backgroundAnimations.ts  # Dibujos canvas de cada fondo
└── minigames/               # 20 minijuegos del Casino + registro
```

---

## 🧰 Stack técnico

- **React 18 + TypeScript**
- **Vite 8**
- **PokeAPI** (REST) para especies, movimientos, sprites y cadenas evolutivas
- **Supabase** (Auth + Postgres) para ranking, PvP y Co-op
- **Canvas 2D** para fondos animados y algunos minijuegos
- **AudioContext** para música y efectos
- **LocalStorage** para persistencia
