# ng-packagr 22.2 regressions: root source map and `@packageDocumentation`

Minimal reproduction for [ng-packagr#3465](https://github.com/ng-packagr/ng-packagr/issues/3465).

ng-packagr 22.2 replaced rollup and rollup-plugin-dts with rolldown and rolldown-plugin-dts for the FESM and `.d.ts` bundles. Two things in the published output changed between 22.1.1 and 22.2.4:

1. An entry point that only re-exports gets no `.mjs.map` and no `sourceMappingURL`.
2. A `@packageDocumentation` comment above an `import` disappears from the bundled `.d.ts`.

Both trace back to the new bundlers, not to ng-packagr's own code. Details are below.

## Run it

```sh
npm install
npm run compare
```

`compare` builds `lib/` with ng-packagr 22.1.1 and then with 22.2.4, and checks the output after each build:

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

Two scripts reproduce each problem without ng-packagr:

```sh
node rolldown-only.mjs   # source map
node dts-only.mjs        # @packageDocumentation
```

## The package

`lib/` has one primary and one secondary entry point:

| File | Content |
|---|---|
| `lib/index.ts` | `export { greet } from 'repro-lib/core';` and nothing else |
| `lib/core/index.ts` | a `@packageDocumentation` comment, then `import { greet } from './greet'`, then `export { greet }` and `export const GREETERS` |
| `lib/core/greet.ts` | the `greet` function |

## 1. The root entry point loses its source map

### What happens

With 22.2.4, `fesm2022/repro-lib.mjs` contains a single line, `export { greet } from "repro-lib/core";`. There is no `repro-lib.mjs.map` and no `//# sourceMappingURL` comment. The secondary entry point still gets its map.

### When it happens

The entry chunk has no code of its own. That is the case when the entry file only re-exports from modules the bundler treats as external, such as a sibling entry point of the same package. Add one line of own code to `lib/index.ts`, for example `export const VERSION = '0.0.0';`, and the map comes back.

### Cause

ng-packagr asks for a map and writes whatever rolldown returns:

- [`write-bundles.transform.ts:102`](https://github.com/ng-packagr/ng-packagr/blob/22.2.4/src/lib/ng-package/entry-point/write-bundles.transform.ts#L102) passes `sourcemap: true` for the FESM bundle.
- [`rolldown.ts:75-83`](https://github.com/ng-packagr/ng-packagr/blob/22.2.4/src/lib/flatten/rolldown.ts#L75-L83) passes it on to `bundle.write()`.

For a chunk with no own code, rolldown 1.2.14 returns `chunk.map === null` and writes neither the map nor the `sourceMappingURL` comment. rollup 4.64.7, which ng-packagr 22.1.1 used, writes a map for the same input. `rolldown-only.mjs` shows the difference with rolldown alone:

```text
reexport-only: reexport-only.js
with-own-code: with-own-code.js, with-own-code.js.map
```

### Impact

The old map pointed only at comment lines (`index.ts` and the generated `repro-lib.ts` bundle index), because the chunk has no executable code. Debugging loses nothing. Tools that expect a `.map` next to every `.mjs` notice the gap, such as tarball manifests or source map upload steps.

### Possible fixes

- **In rolldown.** Emit a map for a chunk without own code when `sourcemap` is on, as rollup does. That fixes it for every rolldown user.
- **In ng-packagr.** In `rolldownBundleFile`, when `opts.sourcemap` is set and an entry chunk comes back with `map === null`, write a map with empty `mappings` and append the `sourceMappingURL` comment.
- **In the library.** Give the entry point one line of its own code.

## 2. `@packageDocumentation` disappears from the bundled `.d.ts`

### What happens

With 22.2.4, `types/repro-lib-core.d.ts` no longer contains the module comment from `lib/core/index.ts`.

### When it happens

The comment sits directly above an `import`, which is the usual spot at the top of an `index.ts`. TypeScript keeps it there in the emitted `.d.ts`. If a declaration follows the comment directly, rolldown-plugin-dts keeps it.

22.1.1 did not keep the comment in every case either. When the entry file only re-exports, with no declaration of its own, 22.1.1 drops it too. That is why `lib/core/index.ts` declares `GREETERS`.

### Cause

rolldown-plugin-dts turns every `.d.ts` into JavaScript, bundles it, and turns the result back into declarations. When it renders the module, it drops statements it does not need, such as the `import`, and with them their comments. Of a dropped statement's comments, it keeps only `#region`-style pragmas:

- [`src/fake-js/index.ts:538-551`](https://github.com/sxzz/rolldown-plugin-dts/blob/v0.28.8/src/fake-js/index.ts#L538-L551) collects `danglingComments` from dropped statements.
- [`src/fake-js/utils.ts:94`](https://github.com/sxzz/rolldown-plugin-dts/blob/v0.28.8/src/fake-js/utils.ts#L94) `pragmaComments()` keeps only comments that start with `#`.

ng-packagr does ask rolldown to keep JSDoc in `.d.ts` output ([`rolldown.ts:87`](https://github.com/ng-packagr/ng-packagr/blob/22.2.4/src/lib/flatten/rolldown.ts#L87), `jsdoc: dtsMode`), but the plugin has already removed the comment by then. rolldown on its own keeps the same comment in a `.js` bundle. `dts-only.mjs` runs the plugin with ng-packagr's options:

```text
comment-above-import: @packageDocumentation dropped
comment-above-declaration: @packageDocumentation kept
```

### Impact

The comment is only documentation. Even in 22.1.1 it ended up in the middle of the bundled file, above the entry's own declarations, not at the top. Tools that read only a file's first comment did not see it in either version.

### Possible fixes

- **In rolldown-plugin-dts.** Carry leading JSDoc comments of dropped statements into `danglingComments`, as it already does for pragmas. It could limit this to comments tagged `@packageDocumentation`, `@module` or `@file`.
- **In the library.** Put a declaration directly below the comment, before any `import`. The comment then attaches to that declaration, so an editor may show it on hover for that symbol.

## Not covered

The bundled `.d.ts` files from 22.2.4 also contain more non-exported declarations than before. The public export lists are identical, so this reproduction leaves that out.
