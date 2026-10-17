# ng-packagr 22.2 regressions: root source map and `@packageDocumentation`

Minimal reproduction for [ng-packagr#3465](https://github.com/ng-packagr/ng-packagr/issues/3465).

`lib/` is a package with one primary and one secondary entry point:

- `lib/index.ts` (primary) only re-exports from `repro-lib/core`.
- `lib/core/index.ts` (secondary) starts with a `@packageDocumentation` comment and declares `GREETERS` itself.

## Run

```sh
npm install
npm run compare
```

`compare` builds with ng-packagr 22.1.1 and then 22.2.4, and checks the output after each build:

```text
ng-packagr@22.1.1 output:
PASS  root fesm2022/repro-lib.mjs.map exists
PASS  root fesm2022/repro-lib.mjs has a sourceMappingURL
PASS  secondary fesm2022/repro-lib-core.mjs.map exists
PASS  types/repro-lib-core.d.ts keeps @packageDocumentation

ng-packagr@22.2.4 output:
FAIL  root fesm2022/repro-lib.mjs.map exists
FAIL  root fesm2022/repro-lib.mjs has a sourceMappingURL
PASS  secondary fesm2022/repro-lib-core.mjs.map exists
FAIL  types/repro-lib-core.d.ts keeps @packageDocumentation
```

## Notes

- The root map comes back once `lib/index.ts` has code of its own, for example `export const VERSION = '0.0.0';`.
- rolldown alone behaves the same way. `node rolldown-only.mjs` bundles two files with `sourcemap: true`, and only the one with its own code gets a `.map`:

  ```text
  reexport-only: reexport-only.js
  with-own-code: with-own-code.js, with-own-code.js.map
  ```
