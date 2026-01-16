import { Injectable } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // Support both AWS S3 and Cloudflare R2
    const isR2 = process.env.STORAGE_PROVIDER === 'r2';
    const accessKeyId =
      process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const bucketName =
      process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;
    const secretAccessKey =
      process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Missing S3/R2 configuration in environment variables');
    }

    const clientConfig: any = {
      region: isR2 ? 'auto' : process.env.AWS_REGION || 'ap-northeast-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    // R2 endpoint if using Cloudflare R2
    if (isR2 && process.env.R2_ACCOUNT_ID) {
      clientConfig.endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    }

    this.s3Client = new S3Client(clientConfig);
    this.bucketName = bucketName;
  }

  // Upload file to S3
  async uploadFile(file: Express.Multer.File, key?: string): Promise<string> {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileKey = key || `${Date.now()}-${sanitizedName}`;

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    await upload.done();
    return fileKey;
  }

  // Get file from S3
  async getFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as any;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // Generate presigned URL for download
  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  // Delete file from S3
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  // List files in S3 bucket
  async listFiles(prefix?: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
    });

    const response = await this.s3Client.send(command);
    return (
      response.Contents?.map((item) => item.Key).filter(
        (key): key is string => key !== undefined,
      ) || []
    );
  }
}
