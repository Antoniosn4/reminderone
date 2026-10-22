// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createDataStore } from '../src/data/dataStore';
import { createMemoryPersistence } from '../src/data/persistence';
import { createSyncEngine } from '../src/data/syncEngine';
import { plainVaultCipher } from './support/syncKit';

const mobilePath = process.env.REMINDER_MOBILE_PATH?.replaceAll('\\', '/');
describe.runIf(Boolean(mobilePath))('desktop and native mobile engines interoperate', () => {
  it('round-trips full CRUD, restart, offline changes, tombstones and unknown fields', async () => {
    const bundled = await build({entryPoints:[`${mobilePath}/src/services/__tests__/support/syncTestKit.ts`], bundle:true, platform:'node', format:'cjs', write:false});
    const loaded = {exports:{}};
    new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
    const kit = loaded.exports;
    const server = kit.createFakeSyncServer();
    const phone = await kit.openDevice('android', server, {start:'2026-10-22T15:00:00.000Z'});
    const disk = createMemoryPersistence();
    let tick = Date.parse('2026-10-22T15:00:01.000Z');
    let desk = createDataStore({persistence:disk, vaultCipher:plainVaultCipher, clock:()=>tick+=1000});
    const cipher = await kit.createWebCryptoCipher();
    const engine = () => createSyncEngine({store:desk,client:server.client(),cipher,deviceId:'desktop'});
    let sync = engine();
    const both = async () => { await sync.sync(); await phone.engine.sync(); await sync.sync(); };
    desk.write('task','review',{title:'Created on desktop',projectId:'inbox',status:'todo',priority:'high',tags:['keep'],createdAt:new Date(tick).toISOString()});
    await both();
    expect((await phone.tasks.get('review')).title).toBe('Created on desktop');
    await phone.tasks.update('review',{title:'Edited on Android'});
    await phone.tasks.setDone('review',true);
    await both();
    expect(desk.get('task','review')).toMatchObject({title:'Edited on Android',status:'done',tags:['keep']});
    await desk.flushed();
    desk=createDataStore({persistence:disk,vaultCipher:plainVaultCipher,clock:()=>tick+=1000});
    await desk.load();sync=engine();
    expect(desk.get('task','review').title).toBe('Edited on Android');
    // Both apps can mutate locally while the network transport is unavailable.
    const offline=await phone.tasks.create({title:'Offline Android'});
    desk.write('task','offline',{title:'Offline desktop',projectId:'inbox',status:'todo'});
    await phone.tasks.remove('review');
    await both();
    expect(desk.get('task',offline.id).title).toBe('Offline Android');
    expect((await phone.tasks.get('offline')).title).toBe('Offline desktop');
    expect(desk.get('task','review')).toBeNull();
    expect(desk.dirtyEntries()).toHaveLength(0);
    expect(await phone.db.getAllAsync('SELECT * FROM sync_queue',[])).toHaveLength(0);
  });
});
