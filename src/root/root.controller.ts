import { Controller, Post, Body } from '@nestjs/common';
import { RootDto, RootResponseDto } from './dto/root.dto';
import { RootService } from './root.service';

@Controller('')
export class RootController {
  constructor(private readonly rootService: RootService) {}

  @Post('/')
  async mutate(@Body() body: RootDto): Promise<RootResponseDto> {
    return this.rootService.route(body);
  }
}
