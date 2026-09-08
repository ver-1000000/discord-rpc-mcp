// Compiled only by smoke tests; never included in release artifacts.
import assert from 'node:assert/strict';
import { AsyncEntry } from '@napi-rs/keyring';

const [id, operation] = process.argv.slice(2);
assert.match(id, /^\d{18}$/);
const entry = new AsyncEntry('discord-rpc-mcp-test', id);
console.log(`Native fixture: ${operation}`);
if (operation === 'write') await entry.setSecret(Buffer.from('SMOKE_TEST_ONLY'));
else if (operation === 'read') assert.equal(Buffer.from(await entry.getSecret()).toString(), 'SMOKE_TEST_ONLY');
else if (operation === 'delete') await entry.deleteCredential();
else if (operation === 'absent') assert.equal(await entry.getSecret(), undefined);
else throw new Error('Unknown fixture operation');
console.log('Native fixture: passed');
