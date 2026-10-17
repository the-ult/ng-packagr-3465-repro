/**
 * `repro-lib/core`
 *
 * Module-level docs that should end up in the bundled `.d.ts`.
 *
 * @packageDocumentation
 */

import { greet } from './greet';

export { greet };

// 22.1 keeps the module comment only when the entry file declares something itself.
export const GREETERS = [greet] as const;
