import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private s3Client: any;
  constructor(
    private readonly loggerService: Logger,
    private readonly configService: ConfigService,
  ) {
    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: this.configService.get('BUCKET_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('BUCKET_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: !!this.configService.get('BUCKET_ENDPOINT'),
      region: this.configService.get('BUCKET_REGION'),
      endpoint: this.configService.get('BUCKET_ENDPOINT'),
    });
  }

  public async listFiles(prefix: string): Promise<string[]> {
    return this.s3Client
      .send(
        new ListObjectsV2Command({
          Bucket: this.configService.get('BUCKET_NAME'),
          Prefix: prefix,
        }),
      )
      .then(async (res: { KeyCount: number; Contents: Record<string, string>[] }) => {
        if (res.KeyCount < 1) return [];
        return res.Contents.map((f: Record<string, string>) => f.Key);
      });
  }

  public async downloadBatch(files: string[]): Promise<[string, Buffer][]> {
    return Promise.all(files.map((file: string) => this.download(file))).then((bufs) =>
      bufs.map((b, i) => [files[i].split('/').at(-1), b]),
    );
  }

  public async download(key: string): Promise<Buffer> {
    return this.s3Client
      .send(
        new GetObjectCommand({
          Bucket: this.configService.get('BUCKET_NAME'),
          Key: key,
        }),
      )
      .then((r: { Body: BodyInit }) =>
        new Response(r.Body).arrayBuffer().then((b) => Buffer.from(b)),
      );
  }

  public async upload(file: Buffer, key: string): Promise<Buffer> {
    return this.s3Client
      .send(
        new PutObjectCommand({
          Bucket: this.configService.get('BUCKET_NAME'),
          Key: key,
          Body: file,
        }),
      )
      .then(() => file);
  }

  public async delete(key: string): Promise<string> {
    return this.s3Client
      .send(
        new DeleteObjectCommand({
          Bucket: this.configService.get('BUCKET_NAME'),
          Key: key,
        }),
      )
      .then(() => key);
  }
}
