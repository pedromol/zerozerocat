import { Test, TestingModule } from '@nestjs/testing';
import { HomeassistantService } from './homeassistant.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { HttpModule } from '@nestjs/axios';

describe('HomeassistantService', () => {
  let service: HomeassistantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule, ConfigModule, HttpModule],
      providers: [HomeassistantService],
    }).compile();

    service = module.get<HomeassistantService>(HomeassistantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
