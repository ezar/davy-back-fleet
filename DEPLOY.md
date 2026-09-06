# Desplegar Davy Back Fleet

Todo el juego cabe en el free tier de Vercel más la integración de Upstash Redis.
Son cuatro pasos y unos diez minutos.

## 1. Importar el repositorio en Vercel

En [vercel.com/new](https://vercel.com/new), importa `ezar/davy-back-fleet`. Vercel
detecta Next.js solo: no hay que tocar el comando de build ni el directorio de salida.

El primer despliegue funcionará **a medias a propósito**: el modo contra la IA es todo
cliente y funciona ya; el multijugador dará un 503 con un mensaje explicándolo hasta que
hagas el paso 2.

## 2. Conectar Upstash Redis

En el proyecto de Vercel: pestaña **Storage** → **Create Database** → **Upstash Redis**
(está en el Marketplace, con plan gratuito). Al conectarla al proyecto, Vercel inyecta
las variables de entorno automáticamente.

Dos cosas que importan:

- **Elige la región más cercana a quien vaya a jugar.** El polling va a un disparo por
  segundo, así que la latencia se nota. Si jugáis desde España, una región europea.
- **Vuelve a desplegar después de conectarla.** Las variables solo entran en las
  funciones en el despliegue siguiente; el que ya estaba hecho no las ve.

No hace falta copiar nada a mano. El código acepta los dos juegos de nombres que usa
Upstash según cómo la conectes (`KV_REST_API_URL` / `KV_REST_API_TOKEN` o
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), así que da igual cuál te toque.

## 3. Comprobar que ha quedado bien

Abre `https://TU-DESPLIEGUE.vercel.app/api/health`. Devuelve algo así:

```json
{ "solo": "ready", "multiplayer": "ready", "roundTripMs": 42 }
```

- `multiplayer: "ready"` → listo, crea una sala y a jugar.
- `multiplayer: "not-configured"` → falta la integración, o falta volver a desplegar
  después de conectarla.
- `multiplayer: "unreachable"` → las credenciales están, pero Redis no contesta. Suele
  ser una base de datos pausada o borrada en Upstash.

Si alguien te dice que al crear sala le sale *"Algo ha ido mal en el barco"*, es este
último caso: Redis dejó de responder con la partida ya en marcha. Mira `/api/health`
antes de tocar nada.

El `roundTripMs` es la ida y vuelta a Redis desde la función. Si se va por encima de
unos 200 ms de forma constante, la función y la base de datos están en continentes
distintos: revisa las regiones del paso 2.

## 4. Instalarlo en los móviles de casa

Es una PWA: al abrir la web en el móvil, **Añadir a pantalla de inicio** la instala con
su icono y sin barra del navegador. En iOS está en el menú de compartir de Safari; en
Android, en el menú de Chrome.

## Sobre el consumo del free tier

La sincronización es polling HTTP: cada jugador pide el estado **una vez por segundo**
mientras la pestaña está en primer plano, y **una cada cinco segundos** si la deja en
segundo plano. Cada petición es una lectura de Redis.

Echando la cuenta: una partida de 15 minutos con los dos jugadores mirando la pantalla
todo el rato son unas 1.800 lecturas. Para uso familiar —unas cuantas partidas al día—
sobra de largo con el plan gratuito, pero conviene mirar los límites vigentes de Upstash
y de Vercel antes de darlo por sentado, porque cambian.

Si alguna vez se quedara corto, lo más rentable es subir el intervalo de polling: está
en una constante, `POLL_MS` en `hooks/useRoom.ts`. Pasar de 1 s a 2 s reduce el consumo
a la mitad y en un juego de disparos por turnos casi no se nota.

Las salas caducan solas a las 6 horas de la última jugada (`ROOM_TTL_SECONDS` en
`lib/gameStore.ts`), así que la base de datos no se llena de partidas abandonadas.
