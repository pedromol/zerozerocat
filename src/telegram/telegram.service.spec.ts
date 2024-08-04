import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { StorageModule } from '../storage/storage.module';

describe('TelegramService', () => {
  let service: TelegramService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TelegramService],
      imports: [LoggerModule, ConfigModule, StorageModule],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
