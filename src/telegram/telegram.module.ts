import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { TelegramService } from './telegram.service';
import { StorageModule } from '../storage/storage.module';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [LoggerModule, ConfigModule, StorageModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule { }
