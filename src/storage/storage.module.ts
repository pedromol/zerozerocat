import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { StorageService } from './storage.service';

@Module({
  imports: [LoggerModule, ConfigModule],
  controllers: [],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
