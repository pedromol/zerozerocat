import { Test, TestingModule } from '@nestjs/testing';
import { RootService } from './root.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { OpencvModule } from '../opencv/opencv.module';
import { OnnxModule } from '../onnx/onnx.module';
import { StorageModule } from '../storage/storage.module';
import { TelegramModule } from '../telegram/telegram.module';

describe('RootService', () => {
  let service: RootService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RootService],
      imports: [
        LoggerModule,
        ConfigModule,
        StorageModule,
        OpencvModule,
        OnnxModule,
        TelegramModule,
      ],
    }).compile();

    service = module.get<RootService>(RootService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
