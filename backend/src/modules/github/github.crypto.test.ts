import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken } from './github.crypto';

describe('GitHub Token Encryption (AES-256-GCM)', () => {
  it('successfully encrypts and decrypts an access token', () => {
    const originalToken = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
    const encryptedPayload = encryptToken(originalToken);

    assert.ok(encryptedPayload.encrypted, 'encrypted ciphertext should exist');
    assert.ok(encryptedPayload.iv, 'iv should exist');
    assert.ok(encryptedPayload.tag, 'auth tag should exist');
    assert.notEqual(encryptedPayload.encrypted, originalToken, 'ciphertext must not equal plaintext');

    const decrypted = decryptToken(encryptedPayload);
    assert.equal(decrypted, originalToken, 'decrypted text must match original plaintext');
  });

  it('generates unique IVs and ciphertexts for identical plaintexts (semantic security)', () => {
    const token = 'ghp_abc123xyz789SECRET';
    const enc1 = encryptToken(token);
    const enc2 = encryptToken(token);

    assert.notEqual(enc1.iv, enc2.iv, 'two encryptions of the same token must have different IVs');
    assert.notEqual(enc1.encrypted, enc2.encrypted, 'two encryptions must produce different ciphertexts');

    assert.equal(decryptToken(enc1), token);
    assert.equal(decryptToken(enc2), token);
  });

  it('rejects tampered ciphertext with authentication error (AES-GCM integrity)', () => {
    const token = 'ghp_tamper_test_token';
    const payload = encryptToken(token);

    // Tamper with the last character of the ciphertext
    const tamperedCiphertext =
      payload.encrypted.slice(0, -2) + (payload.encrypted.endsWith('00') ? 'ff' : '00');

    assert.throws(
      () => {
        decryptToken({
          ...payload,
          encrypted: tamperedCiphertext,
        });
      },
      /Unsupported state or unable to authenticate data|bad decrypt/i,
      'tampered ciphertext must fail authentication'
    );
  });

  it('rejects tampered auth tag with authentication error', () => {
    const token = 'ghp_tag_tamper_test';
    const payload = encryptToken(token);

    const tamperedTag =
      payload.tag.slice(0, -2) + (payload.tag.endsWith('aa') ? 'bb' : 'aa');

    assert.throws(
      () => {
        decryptToken({
          ...payload,
          tag: tamperedTag,
        });
      },
      /Unsupported state or unable to authenticate data|bad decrypt/i,
      'tampered auth tag must fail authentication'
    );
  });

  it('rejects tampered IV with authentication error', () => {
    const token = 'ghp_iv_tamper_test';
    const payload = encryptToken(token);

    const tamperedIv =
      payload.iv.slice(0, -2) + (payload.iv.endsWith('11') ? '22' : '11');

    assert.throws(
      () => {
        decryptToken({
          ...payload,
          iv: tamperedIv,
        });
      },
      /Unsupported state or unable to authenticate data|bad decrypt/i,
      'tampered IV must fail authentication'
    );
  });
});
