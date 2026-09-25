import { createClient } from 'redis';

let redisClient;
let redisAvailable = false;

export const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL is not configured; active queue cache is disabled');
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  redisClient = createClient({ url: process.env.REDIS_URL });

  redisClient.on('error', (error) => {
    redisAvailable = false;
    console.error('Redis connection error:', error.message);
  });

  redisClient.on('ready', () => {
    redisAvailable = true;
    console.log('Redis connected');
  });

  redisClient.on('end', () => {
    redisAvailable = false;
  });

  try {
    await redisClient.connect();
    redisAvailable = true;
  } catch (error) {
    redisAvailable = false;
    console.error('Redis unavailable; continuing with MongoDB only:', error.message);
  }

  return redisClient;
};

export const getRedisClient = () => redisClient;

export const isRedisAvailable = () => Boolean(redisClient?.isReady && redisAvailable);

export const setRedisClientForTest = (client, available = true) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setRedisClientForTest can only be used while testing');
  }

  redisClient = client;
  redisAvailable = available;
};
