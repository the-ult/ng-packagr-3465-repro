import { existsSync, readFileSync } from 'node:fs';

const dist = 'dist/repro-lib';
const checks = [
  ['root fesm2022/repro-lib.mjs.map exists', existsSync(`${dist}/fesm2022/repro-lib.mjs.map`)],
  ['secondary fesm2022/repro-lib-core.mjs.map exists', existsSync(`${dist}/fesm2022/repro-lib-core.mjs.map`)],
  [
    'types/repro-lib-core.d.ts keeps @packageDocumentation',
    readFileSync(`${dist}/types/repro-lib-core.d.ts`, 'utf8').includes('@packageDocumentation'),
  ],
];

console.log(`\n${process.argv[2] ?? 'ng-packagr'} output:`);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
process.exitCode = checks.every(([, ok]) => ok) ? 0 : 1;
