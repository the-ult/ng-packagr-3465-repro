// Same @packageDocumentation loss with rolldown + rolldown-plugin-dts alone,
// using the options ng-packagr 22.2.4 passes in src/lib/flatten/rolldown.ts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { rolldown } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

const docs = '/**\n * Module docs.\n *\n * @packageDocumentation\n */\n';
const cases = {
  'comment-above-import': `${docs}import { greet } from './greet';\nexport { greet };\nexport declare const GREETERS: readonly [typeof greet];\n`,
  'comment-above-declaration': `${docs}export declare const GREETERS: readonly [1];\n`,
};

for (const [name, source] of Object.entries(cases)) {
  mkdirSync(`dts-only/${name}`, { recursive: true });
  writeFileSync(`dts-only/${name}/greet.d.ts`, 'export declare function greet(name: string): string;\n');
  writeFileSync(`dts-only/${name}/index.d.ts`, source);

  const bundle = await rolldown({
    input: `dts-only/${name}/index.d.ts`,
    treeshake: false,
    plugins: [dts({ dtsInput: true, tsconfig: false, generator: 'oxc' })],
  });
  const { output } = await bundle.generate({ format: 'es', comments: { legal: true, annotation: false, jsdoc: true } });
  const kept = output[0].code.includes('@packageDocumentation');
  console.log(`${name}: @packageDocumentation ${kept ? 'kept' : 'dropped'}`);
}
