import { PipeTransform, BadRequestException, Injectable } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { ResponseCode, ResponseHelper } from './response-helper';

export class IdValidationPipe implements PipeTransform {
  transform(value: any) {
    if (!isUuid(value)) {
      throw new BadRequestException(
        ResponseHelper.error(ResponseCode.INVALID_REQUEST_DATA),
      );
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
      throw new BadRequestException(
        ResponseHelper.error(ResponseCode.INVALID_IMAGE_TYPE),
      );
    }

    // Check file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException(
        ResponseHelper.error(ResponseCode.INVALID_IMAGE_SIZE),
      );
    }

    return file;
  }
}
