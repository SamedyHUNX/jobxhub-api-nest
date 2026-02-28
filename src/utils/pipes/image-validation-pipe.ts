import { PipeTransform, BadRequestException, Injectable } from '@nestjs/common';
import { validate as isUuid } from 'uuid';

export class IdValidationPipe implements PipeTransform {
  transform(value: any) {
    if (!isUuid(value)) {
      throw new BadRequestException('Invalid request data');
    }
    return value;
  }
}

@Injectable()
export class ImageValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File) {
    if (!file) {
      return file;
    }

    // Check file type
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
      throw new BadRequestException('Invalid image type');
    }

    // Check file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image size is too big');
    }

    return file;
  }
}

@Injectable()
export class ResumeValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File) {
    if (!file) {
      return file;
    }

    // Check file type
    if (!file.mimetype.match(/\/(pdf)$/)) {
      throw new BadRequestException('Invalid file type');
    }

    // Check file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size is too big');
    }

    return file;
  }
}
