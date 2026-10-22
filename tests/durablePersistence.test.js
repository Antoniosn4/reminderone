import { describe, it, expect } from 'vitest';
import { createDataStore } from '../src/data/dataStore';
import { createMemoryPersistence } from '../src/data/persistence';
import { plainVaultCipher } from './support/syncKit';

const open = persistence => createDataStore({ persistence, vaultCipher: plainVaultCipher });
describe('durable desktop storage', () => {
  it('commits records, tombstones, outbox and cursor in one snapshot and survives reopening', async () => {
    const disk = createMemoryPersistence();
    const store = open(disk);
    store.write('task', 'one', { title: 'Persistente' });
    store.write('task', 'deleted', { title: 'Excluir' });
    store.remove('task', 'deleted');
    store.setMeta('cursor', 17);
    await store.flushed();
    const reopened = open(disk);
    await reopened.load();
    expect(reopened.get('task', 'one').title).toBe('Persistente');
    expect(reopened.getRecord('task', 'deleted').deleted).toBe(true);
    expect(reopened.dirtyEntries()).toHaveLength(2);
    expect(reopened.getMeta('cursor')).toBe(17);
  });
  it('reports disk failure instead of acknowledging it and retries the complete state', async () => {
    const disk = createMemoryPersistence();
    const commit = disk.commit;
    disk.commit = async () => { throw new Error('QuotaExceeded'); };
    const store = open(disk);
    store.write('task', 'one', { title: 'Não perder' });
    await expect(store.flushed()).rejects.toThrow('QuotaExceeded');
    expect(store.getPersistenceStatus().state).toBe('error');
    expect(disk.records.size).toBe(0);
    disk.commit = commit;
    await store.retryPersistence();
    const reopened = open(disk);
    await reopened.load();
    expect(reopened.get('task', 'one').title).toBe('Não perder');
    expect(reopened.isDirty('task', 'one')).toBe(true);
  });
  it('fails closed if encrypted record identity was swapped', async () => {
    const disk = createMemoryPersistence();
    const store = open(disk);
    store.write('task', 'one', { title: 'Privado' });
    await store.flushed();
    disk.records.set('task:one', { ...disk.records.get('task:one'), key: 'task:other' });
    await expect(open(disk).load()).rejects.toThrow('adulterada');
  });
});
