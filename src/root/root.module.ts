import { Module } from '@nestjs/common';
import { RootController } from './root.controller';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { RootService } from './root.service';
import { OpencvModule } from '../opencv/opencv.module';
import { StorageModule } from '../storage/storage.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [LoggerModule, ConfigModule, StorageModule, OpencvModule, TelegramModule],
  controllers: [RootController],
  providers: [RootService],
})
export class RootModule { }
