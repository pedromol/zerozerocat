import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './config/config.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new Logger(new PinoLogger({}), {}),
  });
  app.useLogger(app.get(Logger));
  const config: ConfigService<EnvironmentVariables> = app.get(ConfigService);
  return app.listen(config.get('HTTP_PORT'), '0.0.0.0');
}
bootstrap();
