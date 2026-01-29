import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { ConfigService } from '@/config/config.service';
import { getImageKey } from '@/utils/helpers';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    // Support both AWS S3 and Cloudflare R2
    const isR2 = this.configService.storageProvider === 'r2';
    const accessKeyId =
      this.configService.r2AccessKeyId || this.configService.awsAccessKeyId;
    const bucketName =
      this.configService.r2BucketName || this.configService.awsS3BucketName;
    const secretAccessKey =
      this.configService.r2SecretAccessKey ||
      this.configService.awsSecretAccessKey;

    if (!accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Missing S3/R2 configuration in environment variables');
    }

    const clientConfig: any = {
      region: isR2 ? 'auto' : this.configService.awsRegion || 'ap-northeast-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    if (isR2 && !this.configService.r2AccountId) {
      throw new Error(
        'R2_ACCOUNT_ID is required when using Cloudflare R2 storage',
      );
    }

    // R2 endpoint if using Cloudflare R2
    if (isR2 && this.configService.r2AccountId) {
      clientConfig.endpoint = `https://${this.configService.r2AccountId}.r2.cloudflarestorage.com`;
    }

    this.s3Client = new S3Client(clientConfig);
    this.bucketName = bucketName;
  }

  /**
   * Get the public domain URL based on storage provider
   * @returns Public domain URL
   * @throws InternalServerErrorException if domain is not configured
   */
  private getPublicDomain(): string {
    const storageProvider = this.configService.storageProvider;
    const publicDomain =
      storageProvider === 'r2'
        ? this.configService.r2PublicDomain
        : this.configService.awsS3PublicDomain;

    if (!publicDomain) {
      throw new InternalServerErrorException(
        'Storage public domain is not configured',
      );
    }

    return publicDomain;
  }

  /**
   * Build full public URL from a key
   * @param key - S3 object key
   * @returns Full public URL
   */
  getPublicUrl(key: string): string {
    const domain = this.getPublicDomain();
    return `${domain}/${key}`;
  }

  /**
   * Upload file and return its public URL
   * @param file - The file to upload
   * @param category - Category of the file (e.g., 'user', 'organization')
   * @param subcategory - Subcategory (e.g., 'avatar', 'logo')
   * @returns Object containing the S3 key and public URL
   */
  async uploadFileAndGetUrl(
    file: Express.Multer.File,
    category: string,
    subcategory: string,
  ): Promise<{ key: string; url: string }> {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const imageKey = getImageKey(category, subcategory, sanitizedName);

    await this.uploadFile(file, imageKey);

    const imageUrl = this.getPublicUrl(imageKey);

    return { key: imageKey, url: imageUrl };
  }

  // Upload file to S3
  async uploadFile(file: Express.Multer.File, key?: string): Promise<string> {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileKey = key || `${Date.now()}-${sanitizedName}`;
    const body = file.buffer ?? file.stream;
    if (!body) {
      throw new BadRequestException('Uploaded file stream is missing');
    }

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucketName,
        Key: fileKey,
        Body: body,
        ContentType: file.mimetype,
      },
    });

    await upload.done();
    return fileKey;
  }

  // Get file from S3
  async getFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    const response = await this.s3Client.send(command);
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
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
    const keys: string[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response: ListObjectsV2CommandOutput =
        await this.s3Client.send(command);
      response.Contents?.forEach((item) => {
        if (item.Key) keys.push(item.Key);
      });

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return keys;
  }
}
