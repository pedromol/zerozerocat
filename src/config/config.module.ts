import { Module } from '@nestjs/common';
import * as Nest from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import configuration from './config.schema';

@Module({
  imports: [
    Nest.ConfigModule.forRoot({
      cache: true,
      load: [configuration],
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
