import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  Param,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from './s3.service';
import type { Response } from 'express';

@Controller('upload')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
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

  @Get(':key')
  async getFile(@Param('key') key: string, @Res() res: Response) {
    const file = await this.s3Service.getFile(key);
    res.send(file);
  }

  @Get('presigned/:key')
  async getPresignedUrl(@Param('key') key: string) {
    const url = await this.s3Service.getPresignedUrl(key);
    return { url };
  }

  @Delete(':key')
  async deleteFile(@Param('key') key: string) {
    await this.s3Service.deleteFile(key);
    return { message: 'File deleted successfully' };
  }
}
