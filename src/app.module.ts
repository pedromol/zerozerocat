import { Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { RootModule } from './root/root.module';
import { TelegramModule } from './telegram/telegram.module';
import { OnnxModule } from './onnx/onnx.module';
import { OpencvModule } from './opencv/opencv.module';
import { StorageModule } from './storage/storage.module';
import { HomeassistantModule } from './homeassistant/homeassistant.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    HealthModule,
    PrometheusModule.register(),
    RootModule,
    TelegramModule,
    OnnxModule,
    OpencvModule,
    StorageModule,
    HomeassistantModule,
  ],
})
export class AppModule {}
