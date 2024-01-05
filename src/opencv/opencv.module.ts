import { Module } from '@nestjs/common';
import { OpencvService } from './opencv.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [LoggerModule, ConfigModule],
  controllers: [],
  providers: [OpencvService],
  exports: [OpencvService],
})
export class OpencvModule {}
