import { mustBe, a, validate } from 'joi-decorator';
import StaticLogger from '../logger/logger.static';

export class EnvironmentVariables {
  @mustBe(a.string().case('lower').required())
  NODE_ENV: string;

  @mustBe(a.number().integer().min(1).max(65535).required())
  HTTP_PORT: number;

  @mustBe(a.string().required())
  BUCKET_ACCESS_KEY_ID: string;

  @mustBe(a.string().required())
  BUCKET_SECRET_ACCESS_KEY: string;

  @mustBe(a.string().required())
  BUCKET_ENDPOINT: string;

  @mustBe(a.string().required())
  BUCKET_REGION: string;

  @mustBe(a.string().required())
  BUCKET_NAME: string;

  @mustBe(a.number().integer().min(0).required())
  MIN_DETECTIONS: string;

  @mustBe(a.array().required())
  NAME_MAPPINGS: string[];

  @mustBe(a.string().required())
  TELEGRAM_ADDRESS: string;

  @mustBe(a.string().required())
  TELEGRAM_TOKEN: string;

  @mustBe(a.string().required())
  TELEGRAM_CHAT: string;

  @mustBe(a.string().required())
  TELEGRAM_ALT_CHAT: string;

  @mustBe(a.string().required())
  HASS_TOKEN: string;

  @mustBe(a.string().required())
  HASS_ENDPOINT: string;

  constructor() {
    Object.keys(process.env).forEach((key: string) => {
      this[key] = process.env[key];
    });
    this.NAME_MAPPINGS = (this.NAME_MAPPINGS as unknown as string)?.split(',');
    try {
      validate(this, EnvironmentVariables, { allowUnknown: true });
    } catch (err: unknown) {
      StaticLogger.logAndExit(this.constructor.name, err);
    }
  }
}

export default (): EnvironmentVariables => {
  return new EnvironmentVariables();
};
