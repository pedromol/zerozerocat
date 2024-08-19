import { Injectable } from '@nestjs/common';
import { RootDto, RootResponseDto } from './dto/root.dto';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { OpencvService } from '../opencv/opencv.service';
import { StorageService } from '../storage/storage.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class RootService {
  private lock: boolean = false;
  private modelLoaded: boolean = false;
  constructor(
    private readonly loggerService: Logger,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly opencvService: OpencvService,
    private readonly telegramService: TelegramService,
  ) { }

  private async updateModel(): Promise<RootResponseDto> {
    this.loggerService.log(`Updating model`);
    return this.storageService
      .download('/model/model.yaml')
      .then((model: Buffer) => this.opencvService.loadLBPH(model))
      .then(() => (this.modelLoaded = true))
      .then(() => this.loggerService.log(`Model updated`))
      .then(() => new RootResponseDto('ok'));
  }

  private async predict(path: string): Promise<RootResponseDto> {
    if (!this.modelLoaded) await this.updateModel();
    this.loggerService.log(`Processing prediction for ${path}`);
    const ts = path.split('/').at(-1).split('.').at(0);
    const key = path.replace(this.configService.get('BUCKET_NAME') + '/', '');
    return this.storageService
      .download(key)
      .then((file: Buffer) =>
        this.opencvService.predict(file),
      )
      .then((opencv) => {
        const [who] = opencv;
        return this.storageService
          .upload(opencv[1], `/identified/${opencv[0]}${ts}.jpeg`)
          .then(() =>
            this.telegramService
              .sendPhoto(
                opencv[0]
                  ? this.configService.get('TELEGRAM_CHAT')
                  : this.configService.get('TELEGRAM_ALT_CHAT'),
                opencv[1],
                who,
              )
              .then((msg) =>
                this.storageService.upload(
                  Buffer.from(''),
                  `/message/${msg.message_id}-${opencv[0]}${ts}`,
                ),
              )
              .catch((err) => this.loggerService.log(`Failed to send telegram photo: ${err}`)),
          );
      })
      .then(() => new RootResponseDto('ok'));
  }

  private async normalize(names: string[]): Promise<string[]> {
    const labels: string[] = this.configService
      .get('NAME_MAPPINGS')
      .split(',');
    const result: string[][] = new Array(labels.length).fill(null).map(() => []);
    labels.forEach((label, index) => {
      names.forEach((name: string) => {
        if (name.startsWith(`identified/${label}`)) {
          result[index].push(name);
        }
      })
    });
    const min = result.reduce((p, c) => Math.min(p, c.length), Infinity);
    this.loggerService.log(`Training model with ${min * labels.length} samples`);
    return result.map(v => {
      v.splice(0, v.length - min);
      return v;
    }).flat();
  }

  private async train(): Promise<RootResponseDto> {
    if (this.lock) {
      this.loggerService.log(`Already training model`);
      return Promise.resolve(new RootResponseDto('ok'));
    }

    this.lock = true;
    this.loggerService.log(`Training model`);
    return this.storageService
      .listFiles('identified/L')
      .then((names: string[]) => this.normalize(names))
      .then((names: string[]) => this.storageService.downloadBatch(names))
      .then((files) => this.opencvService.generateModel(files))
      .then((model) => this.storageService.upload(model, '/model/model.yaml'))
      .finally(() => (this.lock = false))
      .then(() => new RootResponseDto('ok'));
  }

  async route(dto: RootDto): Promise<RootResponseDto> {
    if (dto.Key?.includes('raw')) {
      return this.predict(dto.Key);
    } else if (dto.Key?.includes('identified/L')) {
      return this.train();
    } else if (dto.Key?.includes('model')) {
      return this.updateModel();
    }
    return Promise.resolve(new RootResponseDto('ok'));
  }
}
