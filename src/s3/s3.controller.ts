import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from './services/s3.service';
import type { Response } from 'express';
import { ConfigService } from '@/common/services/config.service';

@Controller('upload')
export class S3Controller {
  constructor(private readonly s3Service: S3Service, private readonly configService: ConfigService) { }

  // Handles file upload from client
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: parseInt(process.env.R2_FILE_SIZE_LIMIT ?? '10485760') } }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    const key = await this.s3Service.uploadFile(file);
    const url = await this.s3Service.getPresignedUrl(key);

    return {
      success: true,
      data: {
        key,
        url,
      },
      message: 'File uploaded successfully',
    };
  }

  // Retrieves a file directly from S3 by its key
  @Get(':key')
  async getFile(@Param('key') key: string, @Res() res: Response) {
    const file = await this.s3Service.getFile(key);
    res.send(file);
  }

  // Generates a presigned URL for a given file key.
  @Get('presigned/:key')
  async getPresignedUrl(@Param('key') key: string) {
    const url = await this.s3Service.getPresignedUrl(key);
    return { url };
  }

  // Deletes a file from S3 by its key.
  @Delete(':key')
  async deleteFile(@Param('key') key: string) {
    await this.s3Service.deleteFile(key);
    return { message: 'File deleted successfully' };
  }
}
