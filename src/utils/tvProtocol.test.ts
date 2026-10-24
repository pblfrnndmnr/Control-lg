import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMacAddress,
  createWakeOnLanPacket,
  clampVolume,
  formatChannelDisplay,
  formatRemainingTime,
  verifyPairingPin,
  buildWebOSPayload,
  parseNaturalLanguageCommand,
} from './tvProtocol.ts';

test('validateMacAddress validates colon and hyphen separated MACs', () => {
  assert.equal(validateMacAddress('00:1A:2B:3C:4D:5E'), true);
  assert.equal(validateMacAddress('00-1A-2B-3C-4D-5E'), true);
  assert.equal(validateMacAddress('001A2B3C4D5E'), true);
  assert.equal(validateMacAddress('invalid-mac'), false);
  assert.equal(validateMacAddress('00:1A:2B:3C:4D'), false);
  assert.equal(validateMacAddress(''), false);
});

test('createWakeOnLanPacket generates valid 102-byte buffer with 6x0xFF and 16xMAC', () => {
  const mac = 'AA:BB:CC:DD:EE:FF';
  const packet = createWakeOnLanPacket(mac);
  assert.equal(packet.length, 102);

  // Check 6 bytes header
  for (let i = 0; i < 6; i++) {
    assert.equal(packet[i], 0xff);
  }

  // Check repetitions
  const expectedBytes = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
  for (let rep = 0; rep < 16; rep++) {
    for (let b = 0; b < 6; b++) {
      assert.equal(packet[6 + rep * 6 + b], expectedBytes[b]);
    }
  }
});

test('clampVolume keeps volume strictly within 0 and 100', () => {
  assert.equal(clampVolume(50, 5), 55);
  assert.equal(clampVolume(98, 5), 100);
  assert.equal(clampVolume(5, -10), 0);
  assert.equal(clampVolume(0, -1), 0);
  assert.equal(clampVolume(100, 2), 100);
});

test('formatChannelDisplay formats major and sub-channels properly', () => {
  assert.equal(formatChannelDisplay(7), '7');
  assert.equal(formatChannelDisplay(11, 2), '11-2');
  assert.equal(formatChannelDisplay(0), '1');
});

test('formatRemainingTime formats mm:ss and hours correctly', () => {
  assert.equal(formatRemainingTime(1800), '30:00');
  assert.equal(formatRemainingTime(3600), '1h 00m');
  assert.equal(formatRemainingTime(5400), '1h 30m');
  assert.equal(formatRemainingTime(59), '0:59');
  assert.equal(formatRemainingTime(0), '0:00');
});

test('verifyPairingPin handles case-insensitive comparison', () => {
  assert.equal(verifyPairingPin('AB12CD', 'ab12cd'), true);
  assert.equal(verifyPairingPin(' 123456 ', '123456'), true);
  assert.equal(verifyPairingPin('1234', '9999'), false);
  assert.equal(verifyPairingPin('', '1234'), false);
});

test('buildWebOSPayload crafts correct ssap request structures', () => {
  const payload = buildWebOSPayload('turnOff');
  assert.equal(payload.uri, 'ssap://system/turnOff');
  assert.equal(payload.type, 'request');

  const volPayload = buildWebOSPayload('setVolume', { volume: 30 });
  assert.equal(volPayload.uri, 'ssap://audio/setVolume');
  assert.deepEqual(volPayload.payload, { volume: 30 });
});

test('parseNaturalLanguageCommand parses diverse Spanish and English commands', () => {
  // Volume
  assert.deepEqual(parseNaturalLanguageCommand('sube el volumen'), {
    action: 'VOLUME_UP',
    label: 'Subir volumen',
  });
  assert.deepEqual(parseNaturalLanguageCommand('bajar volumen'), {
    action: 'VOLUME_DOWN',
    label: 'Bajar volumen',
  });
  assert.deepEqual(parseNaturalLanguageCommand('volumen a 42'), {
    action: 'SET_VOLUME',
    value: 42,
    label: 'Fijar volumen a 42%',
  });
  assert.deepEqual(parseNaturalLanguageCommand('silencio'), {
    action: 'MUTE_TOGGLE',
    label: 'Alternar silencio (Mute)',
  });

  // Power
  assert.deepEqual(parseNaturalLanguageCommand('apagar tv'), {
    action: 'POWER_OFF',
    label: 'Apagar televisor',
  });
  assert.deepEqual(parseNaturalLanguageCommand('enciende la tele'), {
    action: 'POWER_ON',
    label: 'Encender televisor (WoL)',
  });

  // Apps
  const netflixCmd = parseNaturalLanguageCommand('pon netflix por favor');
  assert.equal(netflixCmd.action, 'LAUNCH_APP');
  assert.equal(netflixCmd.value, 'netflix');

  const youtubeCmd = parseNaturalLanguageCommand('abrir youtube');
  assert.equal(youtubeCmd.action, 'LAUNCH_APP');
  assert.equal(youtubeCmd.value, 'youtube');

  // Inputs
  const hdmiCmd = parseNaturalLanguageCommand('cambiar a hdmi 2');
  assert.equal(hdmiCmd.action, 'SWITCH_INPUT');
  assert.equal(hdmiCmd.value, 'hdmi2');

  // Picture modes
  const cinemaCmd = parseNaturalLanguageCommand('activar modo cine');
  assert.equal(cinemaCmd.action, 'SET_PICTURE_MODE');
  assert.equal(cinemaCmd.value, 'cinema');

  // Channels
  const chCmd = parseNaturalLanguageCommand('canal 13');
  assert.equal(chCmd.action, 'SET_CHANNEL');
  assert.equal(chCmd.value, 13);

  // Sleep Timer
  const timer30 = parseNaturalLanguageCommand('temporizador 30 minutos');
  assert.equal(timer30.action, 'SET_SLEEP_TIMER');
  assert.equal(timer30.value, 30);

  const timer60 = parseNaturalLanguageCommand('apagar en 60 minutos');
  assert.equal(timer60.action, 'SET_SLEEP_TIMER');
  assert.equal(timer60.value, 60);

  const cancelTimer = parseNaturalLanguageCommand('cancelar temporizador');
  assert.equal(cancelTimer.action, 'CANCEL_SLEEP_TIMER');
});

test('getAppIdFromKey maps app names to authentic webOS package IDs', async () => {
  const { getAppIdFromKey } = await import('./tvProtocol.ts');
  assert.equal(getAppIdFromKey('youtube'), 'youtube.leanback.v4');
  assert.equal(getAppIdFromKey('netflix'), 'netflix');
  assert.equal(getAppIdFromKey('prime'), 'amazon');
  assert.equal(getAppIdFromKey('disney'), 'com.disney.disneyplus-prod');
  assert.equal(getAppIdFromKey('custom.app.id'), 'custom.app.id');
});
