# ng-packagr 22.2: missing root source map and `@packageDocumentation`

Minimal reproduction for [ng-packagr#3465](https://github.com/ng-packagr/ng-packagr/issues/3465).

Since 22.2, ng-packagr bundles with rolldown and rolldown-plugin-dts instead of rollup and rollup-plugin-dts ([#3360](https://github.com/ng-packagr/ng-packagr/pull/3360)). Compared with 22.1.1, two things changed in the build output:

1. An entry point that only re-exports gets no `.mjs.map` and no `sourceMappingURL`.
2. A `@packageDocumentation` comment above an `import` is missing from the bundled `.d.ts`.

Neither one breaks anything at runtime. They show up as unexplained changes in the published tarball. Both come from the new bundlers, not from ng-packagr's own code.

## Run it

```sh
npm install
npm run compare
```

`compare` builds `lib/` with ng-packagr 22.1.1, then with 22.2.4, and checks each output:

```text
ng-packagr@22.1.1 output:
PASS  root fesm2022/repro-lib.mjs.map exists
PASS  secondary fesm2022/repro-lib-core.mjs.map exists
PASS  types/repro-lib-core.d.ts keeps @packageDocumentation

ng-packagr@22.2.4 output:
FAIL  root fesm2022/repro-lib.mjs.map exists
PASS  secondary fesm2022/repro-lib-core.mjs.map exists
FAIL  types/repro-lib-core.d.ts keeps @packageDocumentation
```

`lib/index.ts` only re-exports `greet` from the secondary entry point `repro-lib/core`. `lib/core/index.ts` starts with a `@packageDocumentation` comment, then an `import`, then its exports.

## 1. No source map for an entry point without its own code

With 22.2.4, `fesm2022/repro-lib.mjs` is the single line `export { greet } from "repro-lib/core";`, with no map. Add one line of code to `lib/index.ts`, such as `export const VERSION = '0.0.0';`, and the map comes back.

ng-packagr requests a map ([`write-bundles.transform.ts#L102`](https://github.com/ng-packagr/ng-packagr/blob/22.2.4/src/lib/ng-package/entry-point/write-bundles.transform.ts#L102)) and writes what rolldown returns ([`rolldown.ts#L75-L83`](https://github.com/ng-packagr/ng-packagr/blob/22.2.4/src/lib/flatten/rolldown.ts#L75-L83)). For a chunk without its own code, rolldown 1.2.14 returns `chunk.map === null`. rollup 4.64.7 writes a map for the same input. `node rolldown-only.mjs` shows this without ng-packagr:

```text
reexport-only: reexport-only.js
with-own-code: with-own-code.js, with-own-code.js.map
```

The 22.1.1 map only pointed at comment lines, so no debugging information is lost. Only tools that expect a `.map` next to every `.mjs` notice the difference.

Possible fixes, from most to least general:

- rolldown writes a map for such chunks when `sourcemap` is on, as rollup does.
- ng-packagr writes an empty map when it requested one and rolldown returned `null`.
- The library gives the entry point one line of its own code.

## 2. `@packageDocumentation` above an `import` is dropped

With 22.2.4, `types/repro-lib-core.d.ts` no longer contains the module comment. TypeScript keeps the comment above the `import` in the emitted `.d.ts`. rolldown-plugin-dts then drops the `import`, and of a dropped statement's comments it keeps only `#region`-style ones ([`src/fake-js/index.ts#L538-L551`](https://github.com/sxzz/rolldown-plugin-dts/blob/v0.28.8/src/fake-js/index.ts#L538-L551), [`src/fake-js/utils.ts#L94`](https://github.com/sxzz/rolldown-plugin-dts/blob/v0.28.8/src/fake-js/utils.ts#L94)). ng-packagr asks rolldown to keep JSDoc in `.d.ts` output ([`rolldown.ts#L87`](https://github.com/ng-packagr/ng-packagr/blob/22.2.4/src/lib/flatten/rolldown.ts#L87)), but the plugin has already removed the comment by then. `node dts-only.mjs` runs the plugin with ng-packagr's options:

```text
comment-above-import: @packageDocumentation dropped
comment-above-declaration: @packageDocumentation kept
```

22.1.1 kept the comment only when the entry file declares something itself, which is why `lib/core/index.ts` exports `GREETERS`. Even then the comment landed mid-file, above that declaration, so tools that read only a file's first comment never saw it.

Possible fixes:

- rolldown-plugin-dts keeps leading JSDoc of dropped statements, as it already does for `#region` comments.
- The library puts a declaration directly below the comment, before any `import`. Tested with 22.2.4.

## Related ng-packagr changes

| PR or issue | Change |
|---|---|
| [#3360](https://github.com/ng-packagr/ng-packagr/pull/3360) | Replaces rollup with rolldown. Both changes start here. |
| [#3361](https://github.com/ng-packagr/ng-packagr/pull/3361) | Uses the `oxc` generator for `.d.ts` bundling. The comment is dropped with the default generator too. |
| [#3413](https://github.com/ng-packagr/ng-packagr/pull/3413) | Sets `dtsInput: true` and `tsconfig: false` on rolldown-plugin-dts. |
| [#3347](https://github.com/ng-packagr/ng-packagr/issues/3347) | Asked to strip JSDoc from `.mjs` files. That change is intentional and unrelated to the `.d.ts` comment. |
| [#3268](https://github.com/ng-packagr/ng-packagr/issues/3268) | Earlier proposal for rolldown-plugin-dts. It listed open plugin bugs, including a JSDoc one. |
