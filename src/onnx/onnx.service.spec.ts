import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { OnnxService } from './onnx.service';

describe('OnnxService', () => {
  let service: OnnxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnnxService],
      imports: [LoggerModule, ConfigModule],
    }).compile();

    service = module.get<OnnxService>(OnnxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
