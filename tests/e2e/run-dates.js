// Ripete i test end-to-end con l'orologio simulato, nelle date in cui i calcoli sui giorni possono sbagliare.
import { spawnSync } from 'node:child_process';

const CRITICAL_DATES = [
  ['venerdì di fine mese: il prossimo giorno lavorativo è nel mese dopo', '2026-07-31T10:00:00Z'],
  ['notte di capodanno: in UTC è ancora il 31, a Roma è già l\'anno nuovo', '2026-12-31T23:30:00Z'],
  ['sabato prima del passaggio all\'ora legale', '2027-03-27T10:00:00Z'],
  ['sabato prima del ritorno all\'ora solare', '2026-10-24T10:00:00Z'],
];

const failed = [];
for (const [description, now] of CRITICAL_DATES) {
  console.log(`\n=== ${now}: ${description}`);
  const { status } = spawnSync('npx playwright test', {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, E2E_NOW: now },
  });
  if (status !== 0) failed.push(now);
}

console.log(failed.length > 0 ? `\nFalliti: ${failed.join(', ')}` : '\nTutte le date critiche superate.');
process.exitCode = failed.length > 0 ? 1 : 0;
