import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { S3Module } from '@/s3/s3.module';
import { OrganizationsService } from './organizations.service';
import { InngestModule } from '@/inngest/inngest.module';

@Module({
  imports: [S3Module, InngestModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
