# Davy Back Fleet

Hundir la flota con los barcos de One Piece. Tablero 10×10, dos modos: multijugador
remoto por código de sala y un jugador contra la IA.

## Puesta en marcha

```bash
npm install
npm run dev          # http://localhost:3000
```

El **modo solitario funciona sin configurar nada**. Para el multijugador hace falta
Upstash Redis (integración de Vercel Marketplace, free tier):

```bash
cp .env.example .env.local   # y rellena las dos variables
```

Sin credenciales y fuera de producción, las salas se guardan en memoria para poder
desarrollar en local; en producción el multijugador se apaga con un mensaje claro en vez
de perder partidas en silencio (el modo contra la IA sigue funcionando).

Para publicarlo: **[DEPLOY.md](DEPLOY.md)**. `GET /api/health` dice de un vistazo si el
despliegue tiene el multijugador en condiciones.

```bash
npm test         # 83 tests de lógica, IA y salas
npm run typecheck
npm run lint
npm run build
```

Estos cuatro comandos son los que ejecuta CI (`.github/workflows/ci.yml`) en cada
push a `main` y en cada pull request.

## Cómo está montado

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Estado cliente | Zustand |
| Estilos | Tailwind CSS |
| Animación | Framer Motion |
| Estado compartido | Upstash Redis |
| Sincronización | Polling HTTP cada 1 s (5 s con la pestaña en segundo plano) |
| Distribución | PWA instalable |

```
app/
├── api/room/{create,join,state,place,shoot,rematch}/route.ts
└── (game)/
    ├── page.tsx              # crear sala / unirse / solitario
    ├── room/[code]/page.tsx  # partida multijugador
    └── solo/page.tsx         # partida contra la IA
lib/
├── gameLogic.ts    # tablero, colocación válida, disparos, victoria
├── aiOpponent.ts   # IA hunt/target
├── room.ts         # dominio de sala (puro, sin Redis)
├── gameStore.ts    # persistencia en Redis
├── boardView.ts    # estado visual de cada celda
└── fleet.ts        # los cinco barcos y sus metadatos
store/useGameStore.ts   # partida en solitario (Zustand)
hooks/useRoom.ts        # polling de la sala
```

### Tres decisiones que conviene conocer

**La fase y el ganador se derivan, no se guardan.** Una sala en Redis solo almacena
el código, el turno y los dos jugadores. Que la partida esté esperando, colocando,
combatiendo o terminada se calcula al leerla. Así, cuando los dos dispositivos
escriben a la vez, no pueden dejar la partida en un estado imposible.

**Cada jugador escribe solo su campo del hash.** La sala es un hash de Redis con los
campos `meta`, `host` y `guest`. Colocar la flota toca únicamente el campo propio, y
disparar está serializado por el turno, así que no hacen falta locks ni transacciones.
Crear sala y unirse usan `hsetnx`, que resuelve atómicamente quién llega primero.

**La flota rival nunca sale del servidor.** El endpoint de polling devuelve una vista
censurada por jugador: tu flota completa, los disparos que has recibido y los que tú
has hecho. Las casillas de un barco enemigo solo se revelan al hundirlo. Hay un test
que lo comprueba.

## La IA

Dos fases, como pide la spec:

- **Caza**: disparo aleatorio entre las celdas no probadas.
- **Objetivo**: al impactar prueba las 4 celdas en cruz; con dos impactos alineados
  sigue esa dirección hasta fallar o hundir.

Está implementada como una **función pura** que deriva la decisión del historial de
disparos, sin estado mutable entre turnos. Eso hace que sea trivial de testear: hay
una simulación de 200 partidas completas que comprueba que siempre termina, nunca
repite celda y hunde los 17 objetivos.

`chooseAiShot` acepta tres estrategias de caza, medidas sobre 400 partidas con semilla:

| Estrategia | Disparos | Dónde se usa |
|---|---|---|
| `random` | 61,2 | "Normal", el valor por defecto |
| `parity` | 52,8 | Solo en los tests: es la explicación de por qué funciona el damero |
| `density` | 45,0 | "Difícil" |

`density` cuenta, para cada celda sin probar, de cuántas formas podrían encajar encima
los barcos que siguen a flote, y dispara donde más quepan. Subsume el damero y además
sabe que una esquina es mala apuesta y que una franja de agua de tres casillas ya no
puede esconder el barco de cuatro. Los números de la tabla están cubiertos por un test:
la pantalla de ajustes los enseña y no deben mentir.

## Reglas

- Flota clásica 5-4-3-3-2: Thousand Sunny, Moby Dick, Going Merry, Oro Jackson y Red Force.
- Los barcos **no pueden tocarse**, ni siquiera en diagonal (la variante clásica
  española), y **quien acierta repite turno**, como en el juego de mesa. Las dos son
  ajustables.
- En **multijugador las reglas son de la sala**: las elige quien la crea, viajan en
  `meta.rules` y valen para toda la partida, porque los dos jugadores tienen que estar
  jugando al mismo juego. En **solitario** salen de ajustes. En ambos casos se congelan
  al empezar la partida.
- Las salas guardadas antes de que existieran las reglas se completan con las estándar
  (`rulesOf`), así que una partida en curso no cambia de comportamiento.
- **Revancha** desde la pantalla de resultado: misma sala, mismo código, mismas reglas,
  y empieza quien perdió. Al rival le llega por el polling.
- Colocación manual y aleatoria desde la v1: arrastra un barco para moverlo, tócalo sin
  arrastrar para girarlo, o pulsa "Colocación aleatoria" tantas veces como quieras.

## Diseño

La maquetación salió de Claude Design y está aplicada. Los tokens (colores,
tipografías, sombras) siguen centralizados en `tailwind.config.ts`: cambiarlos ahí
repinta todo el juego.

- **Tipografía**: Cinzel para titulares, Karla para texto, cargadas con `next/font`
  (auto-hospedadas, sin petición a Google en tiempo de ejecución).
- **Cada barco tiene su color** (`lib/fleet.ts`), y con él se pinta en el tablero, en
  las listas de flota y en su silueta. Un rótulo de 7 px sobre una casilla de 31 px no
  se lee; el color sí.
- **Las siluetas** son un componente SVG (`components/ShipSilhouette.tsx`) que se colorea
  solo: el número de mástiles crece con el tamaño del barco.

## Fuera de alcance

Power-ups por personaje, modo espectador y estadísticas entre partidas.
