import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PhaseStepType,
  GSDEventType,
  PhaseType,
  type PhaseOpInfo,
  type PhaseStepResult,
  type PhaseRunnerResult,
  type HumanGateCallbacks,
  type PhaseRunnerOptions,
  type GSDPhaseStartEvent,
  type GSDPhaseStepStartEvent,
  type GSDPhaseStepCompleteEvent,
  type GSDPhaseCompleteEvent,
} from './types.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Phase lifecycle types', () => {
  // ─── PhaseStepType enum ────────────────────────────────────────────────

  describe('PhaseStepType', () => {
    it('has all expected step values', () => {
      expect(PhaseStepType.Discuss).toBe('discuss');
      expect(PhaseStepType.Research).toBe('research');
      expect(PhaseStepType.Plan).toBe('plan');
      expect(PhaseStepType.Execute).toBe('execute');
      expect(PhaseStepType.Verify).toBe('verify');
      expect(PhaseStepType.Advance).toBe('advance');
    });

    it('has exactly 7 members', () => {
      const values = Object.values(PhaseStepType);
      expect(values).toHaveLength(7);
    });
  });

  // ─── GSDEventType phase lifecycle values ───────────────────────────────

  describe('GSDEventType phase lifecycle events', () => {
    it('includes PhaseStart', () => {
      expect(GSDEventType.PhaseStart).toBe('phase_start');
    });

    it('includes PhaseStepStart', () => {
      expect(GSDEventType.PhaseStepStart).toBe('phase_step_start');
    });

    it('includes PhaseStepComplete', () => {
      expect(GSDEventType.PhaseStepComplete).toBe('phase_step_complete');
    });

    it('includes PhaseComplete', () => {
      expect(GSDEventType.PhaseComplete).toBe('phase_complete');
    });
  });

  // ─── PhaseOpInfo shape validation ──────────────────────────────────────

  describe('PhaseOpInfo interface', () => {
    it('accepts a valid phase-op output object', () => {
      const info: PhaseOpInfo = {
        phase_found: true,
        phase_dir: '.planning/phases/05-Skill-Scaffolding',
        phase_number: '5',
        phase_name: 'Skill Scaffolding',
        phase_slug: 'skill-scaffolding',
        padded_phase: '05',
        has_research: false,
        has_context: false,
        has_plans: false,
        has_verification: false,
        plan_count: 0,
        roadmap_exists: true,
        planning_exists: true,
        commit_docs: true,
        context_path: '.planning/phases/05-Skill-Scaffolding/CONTEXT.md',
        research_path: '.planning/phases/05-Skill-Scaffolding/RESEARCH.md',
      };

      expect(info.phase_found).toBe(true);
      expect(info.phase_number).toBe('5');
      expect(info.plan_count).toBe(0);
      expect(info.has_context).toBe(false);
    });

    it('matches the documented init phase-op JSON shape', () => {
      // Simulate parsing JSON from gsd-tools.cjs
      const raw = JSON.parse(JSON.stringify({
        phase_found: true,
        phase_dir: '.planning/phases/03-Auth',
        phase_number: '3',
        phase_name: 'Auth',
        phase_slug: 'auth',
        padded_phase: '03',
        has_research: true,
        has_context: true,
        has_plans: true,
        has_verification: false,
        plan_count: 2,
        roadmap_exists: true,
        planning_exists: true,
        commit_docs: true,
        context_path: '.planning/phases/03-Auth/CONTEXT.md',
        research_path: '.planning/phases/03-Auth/RESEARCH.md',
      }));

      const info = raw as PhaseOpInfo;
      expect(info.phase_found).toBe(true);
      expect(info.has_plans).toBe(true);
      expect(info.plan_count).toBe(2);
      expect(typeof info.phase_dir).toBe('string');
      expect(typeof info.padded_phase).toBe('string');
    });
  });

  // ─── Phase result types ────────────────────────────────────────────────

  describe('PhaseStepResult', () => {
    it('can represent a successful step', () => {
      const result: PhaseStepResult = {
        step: PhaseStepType.Research,
        success: true,
        durationMs: 5000,
      };
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('can represent a failed step with error', () => {
      const result: PhaseStepResult = {
        step: PhaseStepType.Execute,
        success: false,
        durationMs: 12000,
        error: 'Session timed out',
        planResults: [],
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session timed out');
    });
  });

  describe('PhaseRunnerResult', () => {
    it('can represent a complete phase run', () => {
      const result: PhaseRunnerResult = {
        phaseNumber: '3',
        phaseName: 'Auth',
        steps: [
          { step: PhaseStepType.Research, success: true, durationMs: 5000 },
          { step: PhaseStepType.Plan, success: true, durationMs: 3000 },
          { step: PhaseStepType.Execute, success: true, durationMs: 60000 },
        ],
        success: true,
        totalCostUsd: 1.5,
        totalDurationMs: 68000,
      };
      expect(result.steps).toHaveLength(3);
      expect(result.success).toBe(true);
    });
  });

  describe('HumanGateCallbacks', () => {
    it('accepts an object with all optional callbacks', () => {
      const callbacks: HumanGateCallbacks = {
        onDiscussApproval: async () => 'approve',
        onVerificationReview: async () => 'accept',
        onBlockerDecision: async () => 'retry',
      };
      expect(callbacks.onDiscussApproval).toBeDefined();
    });

    it('accepts an empty object (all callbacks optional)', () => {
      const callbacks: HumanGateCallbacks = {};
      expect(callbacks.onDiscussApproval).toBeUndefined();
    });
  });

  describe('PhaseRunnerOptions', () => {
    it('accepts full options', () => {
      const options: PhaseRunnerOptions = {
        callbacks: {},
        maxBudgetPerStep: 3.0,
        maxTurnsPerStep: 30,
        model: 'claude-sonnet-4-6',
      };
      expect(options.maxBudgetPerStep).toBe(3.0);
    });

    it('accepts empty options (all fields optional)', () => {
      const options: PhaseRunnerOptions = {};
      expect(options.callbacks).toBeUndefined();
    });
  });

  // ─── Phase lifecycle event interfaces ──────────────────────────────────

  describe('Phase lifecycle event interfaces', () => {
    it('GSDPhaseStartEvent has correct shape', () => {
      const event: GSDPhaseStartEvent = {
        type: GSDEventType.PhaseStart,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        phaseName: 'Auth',
      };
      expect(event.type).toBe('phase_start');
      expect(event.phaseNumber).toBe('3');
    });

    it('GSDPhaseStepStartEvent has correct shape', () => {
      const event: GSDPhaseStepStartEvent = {
        type: GSDEventType.PhaseStepStart,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        step: PhaseStepType.Research,
      };
      expect(event.type).toBe('phase_step_start');
      expect(event.step).toBe('research');
    });

    it('GSDPhaseStepCompleteEvent has correct shape', () => {
      const event: GSDPhaseStepCompleteEvent = {
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        step: PhaseStepType.Execute,
        success: true,
        durationMs: 45000,
      };
      expect(event.type).toBe('phase_step_complete');
      expect(event.success).toBe(true);
    });

    it('GSDPhaseStepCompleteEvent can include error', () => {
      const event: GSDPhaseStepCompleteEvent = {
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        step: PhaseStepType.Verify,
        success: false,
        durationMs: 2000,
        error: 'Verification failed',
      };
      expect(event.error).toBe('Verification failed');
    });

    it('GSDPhaseCompleteEvent has correct shape', () => {
      const event: GSDPhaseCompleteEvent = {
        type: GSDEventType.PhaseComplete,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        phaseName: 'Auth',
        success: true,
        totalCostUsd: 2.5,
        totalDurationMs: 120000,
        stepsCompleted: 5,
      };
      expect(event.type).toBe('phase_complete');
      expect(event.stepsCompleted).toBe(5);
    });
  });
});

