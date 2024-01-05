import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { OnnxService } from './onnx.service';

@Module({
  imports: [LoggerModule, ConfigModule],
  controllers: [],
  providers: [OnnxService],
  exports: [OnnxService],
})
export class OnnxModule {}
