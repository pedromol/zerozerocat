import { Test, TestingModule } from '@nestjs/testing';
import { OpencvService } from './opencv.service';

describe('OpencvService', () => {
  let service: OpencvService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpencvService],
    }).compile();

    service = module.get<OpencvService>(OpencvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
