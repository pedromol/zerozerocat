export interface RootDto {
  EventName: string;
  Key: string;
  Records: Record[];
}

export interface Record {
  eventVersion: string;
  eventSource: string;
  awsRegion: string;
  eventTime: string;
  eventName: string;
  userIdentity: UserIdentity;
  requestParameters: RequestParameters;
  responseElements: ResponseElements;
  s3: S3;
  source: Source;
}

export interface UserIdentity {
  principalId: string;
}

export interface RequestParameters {
  principalId: string;
  region: string;
  sourceIPAddress: string;
}

export interface ResponseElements {
  'x-amz-id-2': string;
  'x-amz-request-id': string;
  'x-minio-deployment-id': string;
  'x-minio-origin-endpoint': string;
}

export interface S3 {
  s3SchemaVersion: string;
  configurationId: string;
  bucket: Bucket;
  object: Obj;
}

export interface Bucket {
  name: string;
  ownerIdentity: OwnerIdentity;
  arn: string;
}

export interface OwnerIdentity {
  principalId: string;
}

export interface Obj {
  key: string;
  size: number;
  eTag: string;
  contentType: string;
  userMetadata: UserMetadata;
  sequencer: string;
}

export interface UserMetadata {
  'content-type': string;
}

export interface Source {
  host: string;
  port: string;
  userAgent: string;
}

export class RootResponseDto {
  constructor(status: string) {
    this.status = status;
    return this;
  }
  status: string;
}
