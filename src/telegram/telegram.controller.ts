import { Controller, Post, Body } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('')
export class TelegramController {
    constructor(private readonly telegramService: TelegramService) { }

    @Post('/catoso')
    async message(@Body() body: {
        message: {
            chat: { id: any };
            reply_to_message: { message_id: any };
            text: any;
            message_id: any;
        }
    }): Promise<any> {
        return this.telegramService.process(body?.message);
    }
}
