import { describe, it } from 'vitest';

/**
 * Open questions from docs/cambeo-app-spec.md section 11.
 * Heaven/hell special rules are resolved (see heaven-hell.test.ts).
 * Loss-threshold elimination remains open.
 */
describe('open-questions', () => {
  it.skip('over-threshold player is removed from the turn order (spec 11.2 candidate A)', () => {
    // TODO(spec 11.2): choose elimination vs stay-in-play
  });

  it.skip('over-threshold player keeps playing and only loses at scoring (spec 11.2 candidate B)', () => {
    // TODO(spec 11.2): choose elimination vs stay-in-play
  });
});
