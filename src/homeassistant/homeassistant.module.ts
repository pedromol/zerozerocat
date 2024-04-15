import { Module } from '@nestjs/common';
import { HomeassistantService } from './homeassistant.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [LoggerModule, ConfigModule, HttpModule],
  providers: [HomeassistantService],
  exports: [HomeassistantService]
})
export class HomeassistantModule { }
