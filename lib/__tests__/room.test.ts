import { describe, expect, it } from 'vitest';
import { placementCells, randomFleet } from '../gameLogic';
import {
  DEFAULT_RULES,
  RoomError,
  type Room,
  type RoomRules,
  applyPlacement,
  applyShot,
  createRoom,
  generateRoomCode,
  isValidRoomCode,
  joinRoom,
  normalizeRoomCode,
  normalizeRules,
  roomPhase,
  rulesOf,
  sanitizeName,
  seatOf,
  viewRoomFor,
} from '../room';
import { seededRng } from '../rng';
import type { Placement } from '../types';

const HOST_ID = 'host-token-0001';
const GUEST_ID = 'guest-token-0001';

const hostFleet: Placement[] = randomFleet(seededRng(11));
const guestFleet: Placement[] = randomFleet(seededRng(22));

/** Room with both players in and both fleets placed. */
function battleRoom(rules?: RoomRules): Room {
  let room = createRoom('AB2CD', 'Luffy', HOST_ID, Date.now(), rules);
  room = joinRoom(room, 'Nami', GUEST_ID);
  room = applyPlacement(room, 'host', hostFleet);
  room = applyPlacement(room, 'guest', guestFleet);
  return room;
}

/** A cell of the guest's board with no ship on it. */
function waterOnGuestBoard() {
  return [...Array(100).keys()]
    .map((i) => ({ row: Math.floor(i / 10), col: i % 10 }))
    .find(
      (cell) =>
        !guestFleet.some((p) =>
          placementCells(p).some((c) => c.row === cell.row && c.col === cell.col),
        ),
    )!;
}

describe('room codes', () => {
  it('generates valid 5-character codes', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const code = generateRoomCode(seededRng(seed));
      expect(code).toHaveLength(5);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it('avoids characters that are confused when read aloud', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(generateRoomCode(seededRng(seed))).not.toMatch(/[IO01]/);
    }
  });

  it('normalises what the player types', () => {
    expect(normalizeRoomCode('  ab2cd ')).toBe('AB2CD');
    expect(isValidRoomCode(' ab2cd ')).toBe(true);
    expect(isValidRoomCode('AB2C')).toBe(false);
    expect(isValidRoomCode('AB2C0')).toBe(false);
  });
});

describe('sanitizeName', () => {
  it('trims, cleans and applies a default', () => {
    expect(sanitizeName('  Zoro  ', 'Capitán')).toBe('Zoro');
    expect(sanitizeName('', 'Capitán')).toBe('Capitán');
    expect(sanitizeName(42, 'Capitán')).toBe('Capitán');
    expect(sanitizeName('x'.repeat(50), 'Capitán')).toHaveLength(20);
    expect(sanitizeName('So\u0000nny\u001f', 'Capitán')).toBe('Sonny');
  });
});

describe('derived phases', () => {
  it('waits for the opponent until someone joins', () => {
    const room = createRoom('AB2CD', 'Luffy', HOST_ID);
    expect(roomPhase(room)).toBe('waiting');
    expect(roomPhase(joinRoom(room, 'Nami', GUEST_ID))).toBe('placing');
  });

  it('moves to battle only once both have placed', () => {
    let room = joinRoom(createRoom('AB2CD', 'Luffy', HOST_ID), 'Nami', GUEST_ID);
    room = applyPlacement(room, 'host', hostFleet);
    expect(roomPhase(room)).toBe('placing');
    room = applyPlacement(room, 'guest', guestFleet);
    expect(roomPhase(room)).toBe('battle');
  });

  it('does not let a third player in', () => {
    const room = joinRoom(createRoom('AB2CD', 'Luffy', HOST_ID), 'Nami', GUEST_ID);
    expect(() => joinRoom(room, 'Usopp', 'other-token-01')).toThrow(RoomError);
  });

  it('rejects invalid fleets', () => {
    const room = joinRoom(createRoom('AB2CD', 'Luffy', HOST_ID), 'Nami', GUEST_ID);
    expect(() => applyPlacement(room, 'host', hostFleet.slice(1))).toThrow(/Flota inválida/);
  });

  it('does not allow rearranging once battle has started', () => {
    expect(() => applyPlacement(battleRoom(), 'host', hostFleet)).toThrow(/recolocar/);
  });
});

describe('turns and shots', () => {
  it('the host starts', () => {
    expect(battleRoom().meta.turn).toBe('host');
  });

  it('the turn passes to the opponent after a miss', () => {
    const room = battleRoom();
    const water = waterOnGuestBoard();
    const { room: next, result } = applyShot(room, 'host', water);
    expect(result.outcome).toBe('miss');
    expect(next.meta.turn).toBe('guest');
  });

  it('a hit earns another turn', () => {
    const room = battleRoom();
    const target = placementCells(guestFleet[0])[0];
    const { room: next, result } = applyShot(room, 'host', target);
    expect(result.outcome).toBe('hit');
    expect(next.meta.turn).toBe('host');
  });

  it('firing out of turn is refused', () => {
    expect(() => applyShot(battleRoom(), 'guest', { row: 0, col: 0 })).toThrow(/No es tu turno/);
  });

  it('repeating a cell is refused', () => {
    const target = placementCells(guestFleet[0])[0];
    const { room } = applyShot(battleRoom(), 'host', target);
    expect(() => applyShot(room, 'host', target)).toThrow(/Ya has disparado/);
  });

  it('firing before the battle is refused', () => {
    const room = joinRoom(createRoom('AB2CD', 'Luffy', HOST_ID), 'Nami', GUEST_ID);
    expect(() => applyShot(room, 'host', { row: 0, col: 0 })).toThrow(/fase de combate/);
  });

  it('the game ends when the whole enemy fleet is sunk', () => {
    let room = battleRoom();
    for (const placement of guestFleet) {
      for (const cell of placementCells(placement)) {
        // The host chains hits, so it never loses the turn.
        room = applyShot(room, 'host', cell).room;
      }
    }
    expect(roomPhase(room)).toBe('finished');
    expect(viewRoomFor(room, HOST_ID).outcome).toBe('won');
    expect(viewRoomFor(room, GUEST_ID).outcome).toBe('lost');
    expect(() => applyShot(room, 'host', { row: 0, col: 0 })).toThrow(/fase de combate/);
  });
});

describe('redacted view', () => {
  it('never reveals the opponent fleet', () => {
    const room = battleRoom();
    const view = viewRoomFor(room, HOST_ID);
    expect(view.you.placements).toEqual(hostFleet);
    expect(JSON.stringify(view)).not.toContain(GUEST_ID);
    // No enemy-fleet cell appears in the view before it has been shot at.
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('"guest"');
    expect(Object.keys(view.opponent)).toEqual(['name', 'present', 'ready', 'outgoingShots']);
  });

  it('only shows shots already fired', () => {
    const target = placementCells(guestFleet[0])[0];
    const { room } = applyShot(battleRoom(), 'host', target);
    const view = viewRoomFor(room, HOST_ID);
    expect(view.opponent.outgoingShots).toHaveLength(1);
    expect(view.you.incomingShots).toHaveLength(0);
    expect(view.yourTurn).toBe(true);
  });

  it('reveals the ship cells only once it sinks', () => {
    let room = battleRoom();
    const cells = placementCells(guestFleet[4]); // Red Force, 2 cells
    room = applyShot(room, 'host', cells[0]).room;
    expect(viewRoomFor(room, HOST_ID).opponent.outgoingShots[0].sunkCells).toBeUndefined();
    room = applyShot(room, 'host', cells[1]).room;
    const last = viewRoomFor(room, HOST_ID).opponent.outgoingShots[1];
    expect(last.outcome).toBe('sunk');
    expect(last.sunkCells).toEqual(cells);
  });

  it('rejects anyone not in the room', () => {
    expect(() => viewRoomFor(battleRoom(), 'intruder-token')).toThrow(/No perteneces/);
    expect(seatOf(battleRoom(), 'intruder-token')).toBeNull();
  });

  it('the guest sees the board from their side', () => {
    const view = viewRoomFor(battleRoom(), GUEST_ID);
    expect(view.seat).toBe('guest');
    expect(view.yourTurn).toBe(false);
    expect(view.opponent.name).toBe('Luffy');
    expect(view.you.placements).toEqual(guestFleet);
  });
});

describe('house rules', () => {
  it('fills in the standard rules for a room stored before they existed', () => {
    const room = battleRoom();
    // A room read back from Redis without the field, as the old ones are.
    const legacy: Room = { ...room, meta: { ...room.meta, rules: undefined } };
    expect(rulesOf(legacy)).toEqual(DEFAULT_RULES);
    expect(viewRoomFor(legacy, HOST_ID).rules).toEqual(DEFAULT_RULES);
  });

  it('keeps only the booleans it recognises', () => {
    expect(normalizeRules(null)).toEqual(DEFAULT_RULES);
    expect(normalizeRules('turno extra')).toEqual(DEFAULT_RULES);
    expect(normalizeRules({ extraTurnOnHit: 'sí' })).toEqual(DEFAULT_RULES);
    expect(normalizeRules({ extraTurnOnHit: false, nonsense: 1 })).toEqual({
      extraTurnOnHit: false,
      allowAdjacent: false,
    });
  });

  it('with the extra turn off, a hit also passes the turn', () => {
    const room = battleRoom({ extraTurnOnHit: false, allowAdjacent: false });
    const target = placementCells(guestFleet[0])[0];
    const { room: next, result } = applyShot(room, 'host', target);
    expect(result.outcome).toBe('hit');
    expect(next.meta.turn).toBe('guest');
  });

  it('a miss passes the turn whatever the rule says', () => {
    for (const extraTurnOnHit of [true, false]) {
      const room = battleRoom({ extraTurnOnHit, allowAdjacent: false });
      const { room: next } = applyShot(room, 'host', waterOnGuestBoard());
      expect(next.meta.turn).toBe('guest');
    }
  });

  it('accepts a fleet with ships touching only where the room allows it', () => {
    const touching: Placement[] = [
      { shipId: 'thousand-sunny', row: 0, col: 0, orientation: 'horizontal' },
      { shipId: 'moby-dick', row: 1, col: 0, orientation: 'horizontal' },
      { shipId: 'going-merry', row: 3, col: 0, orientation: 'horizontal' },
      { shipId: 'oro-jackson', row: 5, col: 0, orientation: 'horizontal' },
      { shipId: 'red-force', row: 7, col: 0, orientation: 'horizontal' },
    ];
    const strict = joinRoom(createRoom('AB2CD', 'Luffy', HOST_ID), 'Nami', GUEST_ID);
    expect(() => applyPlacement(strict, 'host', touching)).toThrow(/adjacent/);

    const loose = joinRoom(
      createRoom('AB2CD', 'Luffy', HOST_ID, Date.now(), {
        extraTurnOnHit: true,
        allowAdjacent: true,
      }),
      'Nami',
      GUEST_ID,
    );
    expect(() => applyPlacement(loose, 'host', touching)).not.toThrow();
  });
});
