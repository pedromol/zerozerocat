import { Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { RootController } from './root/root.controller';
import { StorageService } from './storage/storage.service';
import { OpencvService } from './opencv/opencv.service';
import { OnnxService } from './onnx/onnx.service';
import { TelegramService } from './telegram/telegram.service';
import { RootService } from './root/root.service';
import { RootModule } from './root/root.module';
import { TelegramModule } from './telegram/telegram.module';
import { OnnxModule } from './onnx/onnx.module';
import { OpencvModule } from './opencv/opencv.module';
import { StorageModule } from './storage/storage.module';

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
  ],
  controllers: [RootController],
  providers: [StorageService, OpencvService, OnnxService, TelegramService, RootService],
})
export class AppModule {}
