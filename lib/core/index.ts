/**
 * `repro-lib/core`
 *
 * Module-level docs that should end up in the bundled `.d.ts`.
 *
 * @packageDocumentation
 */

import { greet } from './greet';

export { greet };

/** A declaration in the entry file itself, so the module comment has something to sit above. */
export const GREETERS = [greet] as const;
