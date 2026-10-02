import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { BridgeError } from './errors.js';

export function configDirectory(env = process.env, platform = process.platform) {
  if (env.DISCORD_CONFIG_DIR) return env.DISCORD_CONFIG_DIR;
  if (platform === 'win32') return join(env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'discord-rpc-mcp');
  if (platform === 'darwin') return join(env.HOME ?? homedir(), 'Library', 'Application Support', 'discord-rpc-mcp');
  return join(env.XDG_CONFIG_HOME ?? join(env.HOME ?? homedir(), '.config'), 'discord-rpc-mcp');
}

export async function readLocal(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 65536) throw new Error('Invalid local file');
    if (process.platform !== 'win32' && ((stat.mode & 0o077) || stat.uid !== process.getuid())) {
      throw new BridgeError('FILE_PERMISSIONS', 'Local configuration and credential files must be owned by you and accessible only to you (mode 600).');
    }
    return await handle.readFile('utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    if (error instanceof BridgeError) throw error;
    throw new BridgeError('CONFIG_UNAVAILABLE', 'Could not read the local configuration or credential file.');
  } finally { await handle?.close(); }
}

export async function writeLocal(directory, path, value) {
  if (Buffer.byteLength(value) > 65536) throw new BridgeError('INVALID_CREDENTIALS', 'Local data exceeds the storage limit.');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `.tmp-${randomBytes(16).toString('hex')}`);
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(value);
    await handle.close();
    handle = undefined;
    await rename(temporary, path);
  } catch {
    throw new BridgeError('CONFIG_UNAVAILABLE', 'Could not save the local configuration or credential file.');
  } finally {
    await handle?.close();
    await unlink(temporary).catch(() => {});
  }
}
