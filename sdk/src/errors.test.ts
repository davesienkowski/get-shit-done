/**
 * Unit tests for error classification system.
 *
 * Covers: ErrorClassification enum, GSDError class, exitCodeFor function.
 */

import { describe, it, expect } from 'vitest';
import { ErrorClassification, GSDError, exitCodeFor } from './errors.js';

describe('ErrorClassification', () => {
  it('has exactly 4 members', () => {
    const values = Object.values(ErrorClassification);
    expect(values).toHaveLength(4);
  });

  it('maps Validation to "validation"', () => {
    expect(ErrorClassification.Validation).toBe('validation');
  });

  it('maps Execution to "execution"', () => {
    expect(ErrorClassification.Execution).toBe('execution');
  });

  it('maps Blocked to "blocked"', () => {
    expect(ErrorClassification.Blocked).toBe('blocked');
  });

  it('maps Interruption to "interruption"', () => {
    expect(ErrorClassification.Interruption).toBe('interruption');
  });
});

describe('GSDError', () => {
  it('extends Error', () => {
    const err = new GSDError('test', ErrorClassification.Validation);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "GSDError"', () => {
    const err = new GSDError('test', ErrorClassification.Execution);
    expect(err.name).toBe('GSDError');
  });

  it('carries the classification property', () => {
    const err = new GSDError('bad input', ErrorClassification.Validation);
    expect(err.classification).toBe(ErrorClassification.Validation);
  });

  it('preserves the message', () => {
    const err = new GSDError('something broke', ErrorClassification.Execution);
    expect(err.message).toBe('something broke');
  });

  it('classification is readonly', () => {
    const err = new GSDError('test', ErrorClassification.Blocked);
    // TypeScript enforces readonly at compile time; verify it exists
    expect(err.classification).toBe(ErrorClassification.Blocked);
  });
});

describe('exitCodeFor', () => {
  it('returns 10 for Validation', () => {
    expect(exitCodeFor(ErrorClassification.Validation)).toBe(10);
  });

  it('returns 1 for Execution', () => {
    expect(exitCodeFor(ErrorClassification.Execution)).toBe(1);
  });

  it('returns 11 for Blocked', () => {
    expect(exitCodeFor(ErrorClassification.Blocked)).toBe(11);
  });

  it('returns 1 for Interruption', () => {
    expect(exitCodeFor(ErrorClassification.Interruption)).toBe(1);
  });
});
