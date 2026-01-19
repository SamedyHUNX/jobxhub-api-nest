import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { S3Module } from './s3/s3.module';
import { InngestModule } from './inngest/inngest.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [AuthModule, S3Module, InngestModule, RedisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
