import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {

    if (exception.code === 'LIMIT_FILE_SIZE') {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'File size is too large. Maximum size allowed is 5MB.',
      });
    }

    throw new BadRequestException({
      message: exception.message,
    });
  }
}
