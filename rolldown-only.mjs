// Same source map loss with rolldown alone, without ng-packagr.
import { mkdirSync, writeFileSync } from 'node:fs';
import { rolldown } from 'rolldown';

mkdirSync('rolldown-only', { recursive: true });
writeFileSync('rolldown-only/reexport-only.js', "export { greet } from 'other';\n");
writeFileSync('rolldown-only/with-own-code.js', "export { greet } from 'other';\nexport const VERSION = '0.0.0';\n");

for (const name of ['reexport-only', 'with-own-code']) {
  const bundle = await rolldown({ input: `rolldown-only/${name}.js`, external: ['other'], treeshake: false });
  const { output } = await bundle.write({ dir: `rolldown-only/out/${name}`, format: 'es', sourcemap: true });
  console.log(`${name}: ${output.map((file) => file.fileName).join(', ')}`);
}
