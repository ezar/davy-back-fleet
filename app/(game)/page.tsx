'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <header className="text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-gold/80">
          Hundir la flota
        </p>
        <h1 className="mt-2 font-display text-4xl font-black leading-none">
          Davy Back<span className="text-gold"> Fleet</span>
        </h1>
        <p className="mt-3 text-sm text-foam/60">
          Cinco barcos legendarios, dos capitanes y un mar de por medio.
        </p>
      </header>

      <Suspense fallback={null}>
        <Lobby />
      </Suspense>

      <section className="rounded-xl border border-foam/10 bg-hull/40 p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foam/50">Tu flota</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {FLEET.map((ship) => (
            <li key={ship.id} className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{ship.name}</span>
              <span className="text-xs text-foam/50">
                {ship.crew} · {ship.size}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
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
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-foam/50">Tu nombre</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={20}
          placeholder="Capitán"
          className="mt-1 w-full rounded-lg border border-foam/15 bg-abyss/70 px-3 py-2 text-base outline-none focus:border-gold"
        />
      </label>

      <button
        type="button"
        onClick={() => run('create')}
        disabled={busy !== null}
        className="w-full rounded-xl bg-gold px-4 py-3 font-display text-base font-black text-abyss shadow-plank transition hover:brightness-110 disabled:opacity-50"
      >
        {busy === 'create' ? 'Izando velas…' : 'Crear sala'}
      </button>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
          maxLength={ROOM_CODE_LENGTH}
          placeholder="CÓDIGO"
          autoCapitalize="characters"
          className="w-full rounded-xl border border-foam/15 bg-abyss/70 px-3 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={() => run('join')}
          disabled={busy !== null || !isValidRoomCode(code)}
          className="shrink-0 rounded-xl border border-gold/60 px-4 font-display font-black text-gold transition hover:bg-gold/10 disabled:opacity-40"
        >
          {busy === 'join' ? '…' : 'Unirse'}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-ember/50 bg-ember/15 px-3 py-2 text-sm text-ember">
          {error}
        </p>
      )}

      <Link
        href="/solo"
        className="block rounded-xl border border-foam/15 px-4 py-3 text-center font-semibold text-foam/80 transition hover:border-foam/40"
      >
        Jugar contra la IA
      </Link>
    </div>
  );
}
