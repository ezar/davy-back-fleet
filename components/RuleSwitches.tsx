'use client';

import type { RoomRules } from '@/lib/room';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * The two house rules, bound to the stored preference.
 *
 * The same control serves the lobby (where it decides the rules of the room
 * about to be created) and the settings menu (where it decides the rules of
 * the next solo game): both read the same preference, so whichever way you
 * like to play, you set it once.
 */
export function RuleSwitches() {
  const rules = useSettingsStore((state) => state.rules);
  const setRule = useSettingsStore((state) => state.setRule);

  return (
    <div className="space-y-2.5">
      <RuleRow
        label="Turno extra al acertar"
        hint="Quien acierta vuelve a disparar. Apagado, el turno alterna siempre."
        rule="extraTurnOnHit"
        rules={rules}
        onChange={setRule}
      />
      <RuleRow
        label="Barcos pegados"
        hint="Deja que los barcos se toquen, incluso en diagonal."
        rule="allowAdjacent"
        rules={rules}
        onChange={setRule}
      />
    </div>
  );
}

function RuleRow({
  label,
  hint,
  rule,
  rules,
  onChange,
}: {
  label: string;
  hint: string;
  rule: keyof RoomRules;
  rules: RoomRules;
  onChange: (rule: keyof RoomRules, value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-xs font-bold text-foam/75">{label}</span>
        <span className="block text-[0.65rem] leading-relaxed text-foam/40">{hint}</span>
      </span>
      <Switch checked={rules[rule]} label={label} onChange={(value) => onChange(rule, value)} />
    </div>
  );
}

/** The on/off switch used by every boolean setting. */
export function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition',
        checked ? 'bg-gold' : 'bg-foam/15',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'absolute top-1 h-4 w-4 rounded-full bg-abyss transition-all',
          checked ? 'left-6' : 'left-1',
        ].join(' ')}
      />
    </button>
  );
}
