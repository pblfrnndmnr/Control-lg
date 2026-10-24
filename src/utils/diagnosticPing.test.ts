import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pingPort3001,
  pingPort3000,
  evaluateDiagnosticStatus,
  type DiagnosticResult,
} from './diagnosticPing.ts';

test('pingPort3001 returns open status when fetch resolves with opaque response', async () => {
  const mockFetch: typeof fetch = async (url, options) => {
    assert.ok(String(url).startsWith('https://192.168.1.50:3001'));
    assert.equal(options?.mode, 'no-cors');
    return {
      type: 'opaque',
      status: 0,
      ok: false,
    } as Response;
  };

  const result = await pingPort3001('192.168.1.50', 1000, mockFetch);
  assert.equal(result.isOpen, true);
  assert.equal(result.status, 'open');
  assert.equal(result.port, 3001);
  assert.equal(result.ip, '192.168.1.50');
  assert.match(result.message, /Puerto 3001 Abierto/i);
});

test('pingPort3001 returns blocked status when fetch throws SSL or network error', async () => {
  const mockFetch: typeof fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  const result = await pingPort3001('192.168.1.60', 1000, mockFetch);
  assert.equal(result.isOpen, false);
  assert.equal(result.status, 'blocked');
  assert.match(result.message, /Puerto 3001 Bloqueado/i);
  assert.match(result.details, /Failed to fetch/);
});

test('pingPort3001 returns timeout status when abort controller fires', async () => {
  const mockFetch: typeof fetch = async () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  };

  const result = await pingPort3001('192.168.1.70', 1000, mockFetch);
  assert.equal(result.isOpen, false);
  assert.equal(result.status, 'timeout');
  assert.match(result.message, /Tiempo Agotado/i);
});

test('pingPort3001 handles empty IP address gracefully', async () => {
  const result = await pingPort3001('   ');
  assert.equal(result.isOpen, false);
  assert.equal(result.status, 'blocked');
  assert.match(result.message, /vacía/i);
});

test('pingPort3000 probes port 3000 with mode no-cors', async () => {
  const mockFetch: typeof fetch = async (url, options) => {
    assert.ok(String(url).startsWith('http://192.168.1.80:3000'));
    assert.equal(options?.mode, 'no-cors');
    return {
      type: 'opaque',
      status: 0,
    } as Response;
  };

  const result = await pingPort3000('192.168.1.80', 1000, mockFetch);
  assert.equal(result.isOpen, true);
  assert.equal(result.port, 3000);
});

test('evaluateDiagnosticStatus returns appropriate styles and labels', () => {
  const idle = evaluateDiagnosticStatus(null);
  assert.equal(idle.iconType, 'idle');
  assert.equal(idle.label, 'No probado');

  const openRes: DiagnosticResult = {
    ip: '192.168.1.5',
    port: 3001,
    isOpen: true,
    status: 'open',
    latencyMs: 25,
    message: 'Abierto',
    details: 'ok',
    timestamp: Date.now(),
  };
  const openEval = evaluateDiagnosticStatus(openRes);
  assert.equal(openEval.iconType, 'open');
  assert.match(openEval.label, /Puerto Abierto \(25ms\)/);

  const blockedRes: DiagnosticResult = {
    ip: '192.168.1.5',
    port: 3001,
    isOpen: false,
    status: 'blocked',
    latencyMs: 12,
    message: 'Bloqueado',
    details: 'err',
    timestamp: Date.now(),
  };
  const blockedEval = evaluateDiagnosticStatus(blockedRes);
  assert.equal(blockedEval.iconType, 'blocked');
  assert.equal(blockedEval.label, 'Puerto Bloqueado');
});
