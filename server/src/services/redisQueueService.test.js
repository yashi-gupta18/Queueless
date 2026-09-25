import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const { setRedisClientForTest } = await import('../config/redis.js');
const redisQueueService = await import('./redisQueueService.js');

class MockRedisClient {
  constructor() {
    this.isReady = true;
    this.store = new Map();
  }

  multi() {
    const client = this;
    const commands = [];
    const transaction = {
      del: (...keys) => {
        commands.push(() => client.del(...keys));
        return transaction;
      },
      hSet: (key, fieldOrObject, value) => {
        commands.push(() => client.hSet(key, fieldOrObject, value));
        return transaction;
      },
      zAdd: (key, member) => {
        commands.push(() => client.zAdd(key, member));
        return transaction;
      },
      zRem: (key, value) => {
        commands.push(() => client.zRem(key, value));
        return transaction;
      },
      set: (key, value) => {
        commands.push(() => client.set(key, value));
        return transaction;
      },
      exec: async () => {
        for (const command of commands) {
          await command();
        }

        return [];
      },
    };

    return transaction;
  }

  async del(...keys) {
    keys.forEach((key) => this.store.delete(key));
    return keys.length;
  }

  async hSet(key, fieldOrObject, value) {
    const hash = this.store.get(key) || new Map();

    if (typeof fieldOrObject === 'object') {
      Object.entries(fieldOrObject).forEach(([field, fieldValue]) => {
        hash.set(field, fieldValue);
      });
    } else {
      hash.set(fieldOrObject, value);
    }

    this.store.set(key, hash);
    return 1;
  }

  async hDel(key, field) {
    return this.store.get(key)?.delete(field) ? 1 : 0;
  }

  async hmGet(key, fields) {
    const hash = this.store.get(key) || new Map();
    return fields.map((field) => hash.get(field) || null);
  }

  async zAdd(key, member) {
    const sortedSet = this.store.get(key) || new Map();
    sortedSet.set(member.value, member.score);
    this.store.set(key, sortedSet);
    return 1;
  }

  async zRem(key, value) {
    return this.store.get(key)?.delete(value) ? 1 : 0;
  }

  async zRank(key, value) {
    const values = this.sortedValues(key);
    const rank = values.indexOf(value);
    return rank === -1 ? null : rank;
  }

  async zRange(key, start, end) {
    return this.sortedValues(key).slice(start, end + 1);
  }

  async zCard(key) {
    return this.store.get(key)?.size || 0;
  }

  async set(key, value) {
    this.store.set(key, value);
    return 'OK';
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async eval(script, { keys, arguments: args }) {
    if (keys.length === 2) {
      const activeEntryId = this.store.get(keys[1]) || null;

      if (activeEntryId) {
        return ['ACTIVE', activeEntryId];
      }

      const nextEntryId = this.sortedValues(keys[0])[0];

      if (!nextEntryId) {
        return ['EMPTY'];
      }

      this.store.get(keys[0])?.delete(nextEntryId);
      this.store.set(keys[1], nextEntryId);
      return ['OK', nextEntryId];
    }

    const [waitingKey, servingKey, entriesKey] = keys;
    const [entryId] = args;

    this.store.get(waitingKey)?.delete(entryId);
    this.store.get(entriesKey)?.delete(entryId);

    if ((this.store.get(servingKey) || null) === entryId) {
      this.store.delete(servingKey);
    }

    return 1;
  }

  sortedValues(key) {
    const sortedSet = this.store.get(key) || new Map();
    return [...sortedSet.entries()]
      .sort((left, right) => left[1] - right[1])
      .map(([value]) => value);
  }
}

const makeEntry = (id, joinedAt) => ({
  id,
  _id: id,
  queue: 'queue-1',
  customer: `customer-${id}`,
  tokenNumber: Number(id.replace('entry-', '')),
  status: 'WAITING',
  priority: 'NORMAL',
  joinedAt: new Date(joinedAt),
});

test('tracks active queue order and position in Redis', async () => {
  setRedisClientForTest(new MockRedisClient());

  await redisQueueService.initializeQueue({ id: 'queue-1', status: 'OPEN', currentToken: 0, totalServed: 0 });
  await redisQueueService.addCustomer(makeEntry('entry-1', '2026-09-26T10:00:00.000Z'));
  await redisQueueService.addCustomer(makeEntry('entry-2', '2026-09-26T10:01:00.000Z'));

  assert.deepEqual(await redisQueueService.getQueuePosition('queue-1', 'entry-1'), {
    peopleAhead: 0,
    position: 1,
  });
  assert.deepEqual(await redisQueueService.getQueuePosition('queue-1', 'entry-2'), {
    peopleAhead: 1,
    position: 2,
  });
  assert.equal(await redisQueueService.getWaitingCount('queue-1'), 2);
});

test('atomically assigns only one customer when two staff call next', async () => {
  setRedisClientForTest(new MockRedisClient());

  await redisQueueService.initializeQueue({ id: 'queue-1', status: 'OPEN', currentToken: 0, totalServed: 0 });
  await redisQueueService.addCustomer(makeEntry('entry-1', '2026-09-26T10:00:00.000Z'));
  await redisQueueService.addCustomer(makeEntry('entry-2', '2026-09-26T10:01:00.000Z'));

  const results = await Promise.all([
    redisQueueService.getNextCustomer('queue-1'),
    redisQueueService.getNextCustomer('queue-1'),
  ]);

  assert.equal(results.filter((result) => result.status === 'OK').length, 1);
  assert.equal(results.filter((result) => result.status === 'ACTIVE').length, 1);
  assert.equal(results.find((result) => result.status === 'OK').entryId, 'entry-1');
});

test('completion clears only the served customer from active Redis state', async () => {
  setRedisClientForTest(new MockRedisClient());

  await redisQueueService.initializeQueue({ id: 'queue-1', status: 'OPEN', currentToken: 0, totalServed: 0 });
  await redisQueueService.addCustomer(makeEntry('entry-1', '2026-09-26T10:00:00.000Z'));
  await redisQueueService.addCustomer(makeEntry('entry-2', '2026-09-26T10:01:00.000Z'));

  assert.equal((await redisQueueService.getNextCustomer('queue-1')).entryId, 'entry-1');
  await redisQueueService.markCompleted('queue-1', 'entry-1');

  assert.deepEqual(await redisQueueService.getNextCustomer('queue-1'), {
    status: 'OK',
    entryId: 'entry-2',
  });
});

test('Redis unavailable returns fallbacks instead of throwing', async () => {
  const unavailableClient = new MockRedisClient();
  unavailableClient.isReady = false;
  setRedisClientForTest(unavailableClient, false);

  assert.equal(await redisQueueService.addCustomer(makeEntry('entry-1', '2026-09-26T10:00:00.000Z')), false);
  assert.equal(await redisQueueService.getQueuePosition('queue-1', 'entry-1'), null);
  assert.equal(await redisQueueService.getNextCustomer('queue-1'), null);
});
