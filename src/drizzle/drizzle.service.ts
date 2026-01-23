import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { ConfigService } from '@/config/config.service';

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private configService: ConfigService;
  public db: NodePgDatabase<typeof schema>;
  private pool: Pool;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  async onModuleInit() {
    const sslEnabled = process.env.DB_SSL === 'true';

    this.pool = new Pool({
      host: this.configService.dbHost,
      port: Number(this.configService.dbPort) || 5432,
      user: this.configService.dbUser || 'postgres',
      password: this.configService.dbPassword || 'postgres',
      database: this.configService.dbName || 'mydb',
      ssl: sslEnabled
        ? { rejectUnauthorized: this.configService.isProduction }
        : false,
    });

    this.db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
