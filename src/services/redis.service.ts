import { Injectable, Logger } from '@nestjs/common';
import { RedisClientType, createClient } from 'redis';

@Injectable()
export class RedisService {
    private logger = new Logger('RedisService');

    private client: RedisClientType;

    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
        });

        this.client.connect().catch(console.error);

        this.client.on('connect', () => {
            this.logger.log('Connected to Redis');
        });

        this.client.on('error', (error) => {
            this.logger.error('Redis error: ' + error);

            // Close the connection
            this.client.disconnect();
        });
    }

    async set(key: string, value: any, expireTime?: number) {
        const stringValue = JSON.stringify(value);
        if (expireTime) {
            await this.client.setEx(key, expireTime, stringValue);
        } else {
            await this.client.set(key, stringValue);
        }
    }

    async get(key: string) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }

    async delete(key: string) {
        await this.client.del(key);
    }
}
