// redisClient.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST ,    
  port: Number(process.env.REDIS_PORT) ,  
  password: process.env.REDIS_PASSWORD                   
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

export default redis;
