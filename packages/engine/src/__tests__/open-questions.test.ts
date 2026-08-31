import { describe, it } from 'vitest';

/**
 * Open questions from docs/cambeo-app-spec.md section 11.
 * These tests are skipped until the rules are documented.
 * Do not invent behavior to make them pass.
 */
describe('open-questions', () => {
  it.skip('heaven special rules unspecified (spec 11.1)', () => {
    // EXTENSION POINT: implement when docs/cambeo-rules.md documents heaven rules
  });

  it.skip('hell special rules unspecified (spec 11.1)', () => {
    // EXTENSION POINT: implement when docs/cambeo-rules.md documents hell rules
  });

  it.skip('over-threshold player is removed from the turn order (spec 11.2 candidate A)', () => {
    // TODO(spec 11.2): choose elimination vs stay-in-play
  });

  it.skip('over-threshold player keeps playing and only loses at scoring (spec 11.2 candidate B)', () => {
    // TODO(spec 11.2): choose elimination vs stay-in-play
  });
});
