import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { OpencvService } from './opencv.service';

describe('OpencvService', () => {
  let service: OpencvService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpencvService],
      imports: [LoggerModule, ConfigModule],
    }).compile();

    service = module.get<OpencvService>(OpencvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
