import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LocalStorageDriver } from './local.storage';

describe('Local Storage Driver (LocalStorageDriver)', () => {
  const testStorageDir = path.resolve(process.cwd(), 'scratch/test_storage');
  let driver: LocalStorageDriver;

  before(async () => {
    driver = new LocalStorageDriver(testStorageDir);
  });

  after(async () => {
    try {
      await fs.promises.rm(testStorageDir, { recursive: true, force: true });
    } catch {}
  });

  it('saves file content and computes accurate size and SHA-256 hash', async () => {
    const content = Buffer.from('Hello Versora Storage!');
    const key = 'projects/proj-1/hello.txt';

    const result = await driver.save(key, content);

    assert.strictEqual(result.sizeBytes, content.length);
    assert.strictEqual(result.hash.length, 64); // SHA-256 hex string

    const exists = await driver.exists(key);
    assert.strictEqual(exists, true);

    const retrieved = await driver.getBuffer(key);
    assert.strictEqual(retrieved.toString('utf-8'), 'Hello Versora Storage!');
  });

  it('streams file content accurately', async () => {
    const content = Buffer.from('Stream test payload 123456');
    const key = 'projects/proj-1/stream-file.bin';

    await driver.save(key, content);

    const stream = await driver.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const fullBuffer = Buffer.concat(chunks);

    assert.strictEqual(fullBuffer.toString('utf-8'), 'Stream test payload 123456');
  });

  it('deletes file safely and handles non-existent deletion gracefully', async () => {
    const key = 'projects/proj-1/to-delete.txt';
    await driver.save(key, Buffer.from('delete me'));

    const deleted = await driver.delete(key);
    assert.strictEqual(deleted, true);

    const exists = await driver.exists(key);
    assert.strictEqual(exists, false);

    // Deleting again returns false without throwing
    const deletedAgain = await driver.delete(key);
    assert.strictEqual(deletedAgain, false);
  });

  it('prevents path traversal attempts outside the storage root', async () => {
    const evilKeys = [
      '../../evil.txt',
      'projects/../../../etc/passwd',
      '..\\..\\windows\\system32\\calc.exe',
      '//absolute/path/attack.txt',
    ];

    for (const evilKey of evilKeys) {
      await assert.rejects(
        async () => {
          await driver.save(evilKey, Buffer.from('malicious'));
        },
        (err: Error) => {
          assert.ok(
            err.message.includes('Path traversal') ||
            err.message.includes('traversal attempt')
          );
          return true;
        }
      );
    }
  });
});
