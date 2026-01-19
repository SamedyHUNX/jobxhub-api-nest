import * as winston from 'winston';
import * as path from 'node:path';
import * as fs from 'node:fs';

const env = process.env.NODE_ENV || 'development';
const logLevel = env === 'development' ? 'debug' : 'warn';

export const createWinstonConfig = () => {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return {
    transports: [
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, context }) => {
            return `${timestamp} [${context || 'Application'}] ${level}: ${message}`;
          }),
        ),
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        level: logLevel,
        maxsize: 5242880,
        maxFiles: 5,
      }),
    ],
  };
};
