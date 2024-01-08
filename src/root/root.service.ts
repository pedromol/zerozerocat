import { Injectable } from '@nestjs/common';
import { RootDto, RootResponseDto } from './dto/root.dto';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { OpencvService } from '../opencv/opencv.service';
import { OnnxService } from '../onnx/onnx.service';
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
    private readonly onnxService: OnnxService,
    private readonly telegramService: TelegramService,
  ) {}

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
        Promise.all([this.opencvService.predict(file), this.onnxService.process(file)]),
      )
      .then((result) => {
        const [opencv, onnx] = result;
        const [who] = opencv;
        const hasCat =
          onnx.findIndex((predicate) => predicate[0] == 'cat' && predicate[1] >= 0.5) >= 0;

        if (!hasCat) {
          this.loggerService.log(`Prediction for ${opencv[0]} rejected by YOLO`);
          opencv[0] = undefined;
        }
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
              .catch(() => this.loggerService.log('Failed to send telegram photo')),
          );
      })
      .then(() => new RootResponseDto('ok'));
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
