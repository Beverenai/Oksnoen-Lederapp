import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loginPinStep, normalizeLoginPhone } from './loginPhone';

describe('phone validation before PIN', () => {
  test('invalid phone cannot open either PIN screen', () => {
    for (const phone of ['123', '', '123456789', 'not a phone']) {
      assert.equal(loginPinStep(phone, 'PIN_REQUIRED'), 'none');
      assert.equal(loginPinStep(phone, 'PIN_SETUP_REQUIRED'), 'none');
    }
  });
  test('unknown phone never opens PIN entry or setup', () => {
    assert.equal(loginPinStep('00000000', 'UNKNOWN_PHONE'), 'none');
  });
  test('only a recognized phone with a PIN challenge can proceed', () => {
    assert.equal(loginPinStep('12345678', 'PIN_REQUIRED'), 'enter');
    assert.equal(loginPinStep('12345678', 'PIN_SETUP_REQUIRED'), 'create');
    assert.equal(loginPinStep('12345678', 'NETWORK_ERROR'), 'none');
  });
  test('Norwegian prefixes normalize to eight digits', () => {
    assert.equal(normalizeLoginPhone('+47 12345678'), '12345678');
    assert.equal(normalizeLoginPhone('0047 12345678'), '12345678');
  });
});