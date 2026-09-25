import { getRedisClient, isRedisAvailable } from '../config/redis.js';
import QueueEntry from '../models/queueEntry.model.js';

const ACTIVE_STATUSES = ['WAITING', 'CALLED', 'IN_SERVICE'];

const keyFor = (queueId) => {
  const id = queueId.toString();

  return {
    active: `queue:${id}:active`,
    waiting: `queue:${id}:waiting`,
    serving: `queue:${id}:serving`,
    entries: `queue:${id}:entries`,
  };
};

const toScore = (date) => new Date(date).getTime();

const serializeEntry = (entry) => JSON.stringify({
  id: entry.id || entry._id?.toString(),
  queue: entry.queue?.toString(),
  customer: entry.customer?._id?.toString?.() || entry.customer?.toString(),
  tokenNumber: entry.tokenNumber,
  status: entry.status,
  priority: entry.priority,
  joinedAt: entry.joinedAt?.toISOString?.() || entry.joinedAt,
  calledAt: entry.calledAt?.toISOString?.() || entry.calledAt || null,
  serviceStartedAt: entry.serviceStartedAt?.toISOString?.() || entry.serviceStartedAt || null,
  completedAt: entry.completedAt?.toISOString?.() || entry.completedAt || null,
});

const runRedis = async (operation, fallbackValue = null) => {
  if (!isRedisAvailable()) {
    return fallbackValue;
  }

  try {
    return await operation(getRedisClient());
  } catch (error) {
    console.error('Redis queue sync error:', error.message);
    return fallbackValue;
  }
};

export const redisQueueKeys = keyFor;

export const initializeQueue = async (queue) => {
  const keys = keyFor(queue.id || queue._id);

  return runRedis(async (client) => {
    await client
      .multi()
      .del(keys.active, keys.waiting, keys.serving, keys.entries)
      .hSet(keys.active, {
        queueId: (queue.id || queue._id).toString(),
        status: queue.status,
        currentToken: String(queue.currentToken || 0),
        totalServed: String(queue.totalServed || 0),
        openedAt: queue.openedAt?.toISOString?.() || '',
      })
      .exec();

    return true;
  }, false);
};

export const addCustomer = async (entry) => {
  const keys = keyFor(entry.queue);
  const entryId = (entry.id || entry._id).toString();

  return runRedis(async (client) => {
    await client
      .multi()
      .hSet(keys.entries, entryId, serializeEntry(entry))
      .zAdd(keys.waiting, { score: toScore(entry.joinedAt), value: entryId })
      .exec();

    return true;
  }, false);
};

export const removeCustomer = async (queueId, entryId) => {
  const keys = keyFor(queueId);
  const normalizedEntryId = entryId.toString();

  return runRedis(async (client) => {
    await client.eval(
      `
      redis.call('ZREM', KEYS[1], ARGV[1])
      redis.call('HDEL', KEYS[3], ARGV[1])

      if redis.call('GET', KEYS[2]) == ARGV[1] then
        redis.call('DEL', KEYS[2])
      end

      return 1
      `,
      {
        keys: [keys.waiting, keys.serving, keys.entries],
        arguments: [normalizedEntryId],
      }
    );

    return true;
  }, false);
};

export const getNextCustomer = async (queueId) => {
  const keys = keyFor(queueId);

  return runRedis(async (client) => {
    // This script keeps "Call Next" atomic: only one staff request can move the
    // first waiting id into the serving slot, so two counters cannot claim it.
    const result = await client.eval(
      `
      if redis.call('EXISTS', KEYS[2]) == 1 then
        return {'ACTIVE', redis.call('GET', KEYS[2])}
      end

      local nextEntry = redis.call('ZRANGE', KEYS[1], 0, 0)[1]
      if not nextEntry then
        return {'EMPTY'}
      end

      redis.call('ZREM', KEYS[1], nextEntry)
      redis.call('SET', KEYS[2], nextEntry)
      return {'OK', nextEntry}
      `,
      {
        keys: [keys.waiting, keys.serving],
        arguments: [],
      }
    );

    return {
      status: result?.[0],
      entryId: result?.[1] || null,
    };
  }, null);
};

export const getQueuePosition = async (queueId, entryId) => {
  const keys = keyFor(queueId);

  return runRedis(async (client) => {
    const rank = await client.zRank(keys.waiting, entryId.toString());

    if (rank === null) {
      return null;
    }

    return {
      peopleAhead: rank,
      position: rank + 1,
    };
  }, null);
};

export const getWaitingCount = async (queueId) => {
  const keys = keyFor(queueId);

  return runRedis(async (client) => client.zCard(keys.waiting), null);
};

export const getWaitingCustomers = async (queueId, limit = 25) => {
  const keys = keyFor(queueId);

  return runRedis(async (client) => {
    const ids = await client.zRange(keys.waiting, 0, limit - 1);

    if (!ids.length) {
      return [];
    }

    const entries = await client.hmGet(keys.entries, ids);
    return entries.filter(Boolean).map((entry) => JSON.parse(entry));
  }, null);
};

export const markServing = async (entry) => {
  const keys = keyFor(entry.queue);
  const entryId = (entry.id || entry._id).toString();

  return runRedis(async (client) => {
    await client
      .multi()
      .zRem(keys.waiting, entryId)
      .set(keys.serving, entryId)
      .hSet(keys.entries, entryId, serializeEntry(entry))
      .exec();

    return true;
  }, false);
};

export const markCompleted = async (queueId, entryId) => removeCustomer(queueId, entryId);

export const clearQueue = async (queueId) => {
  const keys = keyFor(queueId);

  return runRedis(async (client) => {
    await client.del(keys.active, keys.waiting, keys.serving, keys.entries);
    return true;
  }, false);
};

export const rebuildQueueFromMongoDB = async (queue) => {
  const initialized = await initializeQueue(queue);

  if (!initialized) {
    return false;
  }

  const entries = await QueueEntry.find({
    queue: queue.id || queue._id,
    status: { $in: ACTIVE_STATUSES },
  }).sort({ joinedAt: 1 });

  for (const entry of entries) {
    if (entry.status === 'WAITING') {
      await addCustomer(entry);
    } else {
      await markServing(entry);
    }
  }

  return true;
};
