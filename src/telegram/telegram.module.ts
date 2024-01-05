import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { TelegramService } from './telegram.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [LoggerModule, ConfigModule, StorageModule],
  controllers: [],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
