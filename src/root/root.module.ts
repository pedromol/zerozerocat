import { Module } from '@nestjs/common';
import { RootController } from './root.controller';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { RootService } from './root.service';
import { OpencvModule } from '../opencv/opencv.module';
import { OnnxModule } from '../onnx/onnx.module';
import { StorageModule } from '../storage/storage.module';
import { TelegramModule } from '../telegram/telegram.module';
import { HomeassistantModule } from '../homeassistant/homeassistant.module';

@Module({
  imports: [LoggerModule, ConfigModule, StorageModule, OpencvModule, OnnxModule, TelegramModule, HomeassistantModule],
  controllers: [RootController],
  providers: [RootService],
})
export class RootModule { }
