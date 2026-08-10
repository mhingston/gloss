import { join } from 'node:path';

const PORT = 9333;
const ROOT = join(import.meta.dir, '..');
const EXT = join(ROOT, '.output', 'chrome-mv3');
const BACKUP = join(ROOT, '.settings-backup.json');

async function waitForCDP(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      // still starting
    }
    await Bun.sleep(250);
  }
  throw new Error('CDP never came up');
}

function cdpCall(wsUrl, method, params = {}, id = Math.floor(Math.random() * 1e9)) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Timeout calling ${method}`));
    }, 15000);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id !== id) return;
      clearTimeout(timer);
      ws.close();
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    });
    ws.addEventListener('error', (e) => {
      clearTimeout(timer);
      reject(e.error || e);
    });
  });
}

async function getBrowserStorage(browserWs, id) {
  try {
    return await cdpCall(browserWs, 'Extensions.getStorageItems', {
      id,
      storageArea: 'local',
    });
  } catch {
    return null;
  }
}

async function setBrowserStorage(browserWs, id, values) {
  await cdpCall(browserWs, 'Extensions.setStorageItems', {
    id,
    storageArea: 'local',
    values,
  });
}

async function loadBackupFile() {
  try {
    return await Bun.file(BACKUP).json();
  } catch {
    return null;
  }
}

async function writeBackupFile(values) {
  if (!values || Object.keys(values).length === 0) return;
  await Bun.write(BACKUP, JSON.stringify(values, null, 2));
}

function storageHasKey(values) {
  const settings = values?.settings;
  return Boolean(settings && typeof settings === 'object' && settings.apiKey);
}

async function listExtensions(browserWs) {
  try {
    const result = await cdpCall(browserWs, 'Extensions.getExtensions', {});
    return result?.extensions ?? [];
  } catch {
    return [];
  }
}

async function reloadInPlace(browserWs, id) {
  const url = `chrome-extension://${id}/options.html`;
  await cdpCall(browserWs, 'Target.createTarget', { url });
  await Bun.sleep(400);
  const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
  const page = targets.find((t) => (t.url || '').startsWith(`chrome-extension://${id}/`));
  if (!page?.webSocketDebuggerUrl) {
    throw new Error('No extension page to reload');
  }
  await cdpCall(page.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: 'chrome.runtime.reload()',
  });
}

const version = await waitForCDP();
const browserWs = version.webSocketDebuggerUrl;
console.log('browser', version.Browser);

let liveStorage = null;
const existing = await listExtensions(browserWs);
const installed = existing.find((ext) => ext.path === EXT);

if (installed) {
  liveStorage = (await getBrowserStorage(browserWs, installed.id))?.data ?? null;
  if (storageHasKey(liveStorage)) {
    await writeBackupFile(liveStorage);
    console.log('backed up settings');
  }
}

const backup = storageHasKey(liveStorage) ? liveStorage : await loadBackupFile();

if (installed) {
  try {
    await reloadInPlace(browserWs, installed.id);
    console.log('reloaded in place', installed.id);
    process.exit(0);
  } catch (err) {
    console.log('in-place reload failed', String(err));
  }

  try {
    await cdpCall(browserWs, 'Extensions.uninstall', { id: installed.id });
    console.log('uninstalled', installed.id);
  } catch (err) {
    console.log('uninstall skipped', String(err));
  }
}

const loaded = await cdpCall(browserWs, 'Extensions.loadUnpacked', { path: EXT });
console.log('loaded', loaded?.id);

const id = loaded?.id;
const restore = storageHasKey(liveStorage) ? liveStorage : backup;
if (id && restore && storageHasKey(restore)) {
  await setBrowserStorage(browserWs, id, restore);
  await writeBackupFile(restore);
  console.log('restored settings');
} else {
  console.log('no settings to restore — paste the API key once more');
}
