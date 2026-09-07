import { Redis } from "ioredis";
import { getEnv } from "@hostpanel/shared/config";

let sharedConnection: Redis | undefined;

/**
 * One shared ioredis connection reused by every Queue/Worker in the
 * process. `maxRetriesPerRequest: null` is required by BullMQ so a
 * transient Redis blip doesn't cause ioredis to give up on a command that
 * BullMQ itself will retry at a higher level.
 */
export function getRedisConnection(): Redis {
  sharedConnection ??= new Redis(getEnv().REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  return sharedConnection;
}
