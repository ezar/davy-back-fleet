'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ShipSilhouette } from '@/components/ShipSilhouette';
import { FLEET } from '@/lib/fleet';
import { ROOM_CODE_LENGTH, isValidRoomCode, normalizeRoomCode } from '@/lib/room';
import {
  ApiError,
  createRoomRequest,
  joinRoomRequest,
  loadName,
  saveName,
  saveSession,
} from '@/lib/roomClient';

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6 pt-11">
      <CompassRose />

      <header className="relative flex flex-col items-center gap-2.5">
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.36em] text-gold">
          Hundir la flota
        </span>
        <div className="flex flex-col items-center">
          <span className="font-display text-[1.7rem] font-extrabold leading-none tracking-[0.16em]">
            DAVY BACK
          </span>
          <span className="font-display text-[3.5rem] font-black leading-[1.02] tracking-[0.06em] text-gold">
            FLEET
          </span>
        </div>
        <div className="flex w-52 items-center gap-2.5">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/55" />
          <span className="h-[5px] w-[5px] rotate-45 bg-gold" />
          <span className="h-px flex-1 bg-gradient-to-r from-gold/55 to-transparent" />
        </div>
        <p className="max-w-[18rem] text-pretty text-center text-[0.82rem] leading-relaxed text-foam/60">
          Cinco barcos legendarios, dos capitanes y un mar de por medio.
        </p>
      </header>

      <Suspense fallback={null}>
        <Lobby />
      </Suspense>

      <div className="flex-1" />

      <section className="relative mt-6 rounded-2xl border border-foam/9 bg-hull/60 px-4 pb-1.5 pt-3">
        <h2 className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-gold/85">
          Tu flota
        </h2>
        <ul className="flex flex-col">
          {FLEET.map((ship) => (
            <li
              key={ship.id}
              className="flex items-center gap-3 border-b border-foam/6 py-[7px] last:border-0"
            >
              <ShipSilhouette shipId={ship.id} className="h-6 w-[38px] shrink-0" />
              <span className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-[0.82rem] font-bold leading-tight">{ship.name}</span>
                <span className="truncate text-[0.62rem] tracking-wide text-foam/42">
                  {ship.crew}
                </span>
              </span>
              <span className="flex shrink-0 gap-[3px]">
                {Array.from({ length: ship.size }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="h-[7px] w-[7px] rounded-[1px]"
                    style={{ background: ship.color }}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/** Background compass rose, behind the title. */
function CompassRose() {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-11 h-[300px] w-[300px] -translate-x-1/2 opacity-[0.07]"
      fill="none"
      stroke="#f2b134"
      strokeWidth={1.1}
    >
      <circle cx="100" cy="100" r="94" />
      <circle cx="100" cy="100" r="72" />
      <circle cx="100" cy="100" r="36" />
      <path d="M100 6v188M6 100h188" />
      <path d="M34 34l132 132M166 34L34 166" />
      <path
        d="M100 18l13 69 69 13-69 13-13 69-13-69-69-13 69-13z"
        fill="#f2b134"
        fillOpacity={0.4}
        stroke="none"
      />
    </svg>
  );
}

function Lobby() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  useEffect(() => {
    setName(loadName());
    const shared = params.get('code');
    if (shared) setCode(normalizeRoomCode(shared));
  }, [params]);

  const run = async (action: 'create' | 'join') => {
    setError(null);
    setBusy(action);
    try {
      saveName(name.trim());
      const response =
        action === 'create'
          ? await createRoomRequest(name.trim())
          : await joinRoomRequest(normalizeRoomCode(code), name.trim());
      saveSession(response.code, response.playerId);
      router.push(`/room/${response.code}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se ha podido conectar');
      setBusy(null);
    }
  };

  return (
    <div className="relative mt-7 space-y-2.5">
      <label className="block">
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-foam/45">
          Tu nombre
        </span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={20}
          placeholder="Capitán"
          className="mt-1.5 h-[50px] w-full rounded-xl border border-foam/14 bg-hull/72 px-4 text-base font-medium outline-none transition focus:border-gold"
        />
      </label>

      <button
        type="button"
        onClick={() => run('create')}
        disabled={busy !== null}
        className="h-[54px] w-full rounded-[13px] bg-gold font-display text-[1.05rem] font-extrabold tracking-[0.07em] text-abyss shadow-plank transition hover:brightness-110 disabled:opacity-50"
      >
        {busy === 'create' ? 'IZANDO VELAS…' : 'CREAR SALA'}
      </button>

      <div className="flex gap-2.5">
        <input
          value={code}
          onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
          maxLength={ROOM_CODE_LENGTH}
          placeholder="CÓDIGO"
          autoCapitalize="characters"
          className="h-[54px] w-full rounded-[13px] border border-foam/14 bg-hull/72 text-center font-mono text-lg tracking-[0.3em] outline-none transition placeholder:text-foam/32 focus:border-gold"
        />
        <button
          type="button"
          onClick={() => run('join')}
          disabled={busy !== null || !isValidRoomCode(code)}
          className="w-[6.6rem] shrink-0 rounded-[13px] border border-gold/60 bg-gold/9 font-display font-bold text-gold transition hover:bg-gold/15 disabled:opacity-40"
        >
          {busy === 'join' ? '…' : 'Unirse'}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-ember/50 bg-ember/15 px-3 py-2 text-sm text-ember"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 py-2">
        <span className="h-px flex-1 bg-foam/11" />
        <span className="text-[0.7rem] tracking-[0.12em] text-foam/36">o navega en solitario</span>
        <span className="h-px flex-1 bg-foam/11" />
      </div>

      <Link
        href="/solo"
        className="flex h-[54px] items-center justify-center gap-2.5 rounded-[13px] border border-foam/18 bg-hull/45 text-[0.95rem] font-bold text-foam/90 transition hover:border-foam/40"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[19px] w-[19px]"
          fill="none"
          stroke="#f2b134"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 4l11 11M15 15l4 4-2 2-4-4M20 4L9 15M9 15l-4 4 2 2 4-4" />
        </svg>
        Jugar contra la IA
      </Link>
    </div>
  );
}
