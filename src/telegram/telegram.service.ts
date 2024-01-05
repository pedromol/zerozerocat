import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import * as TelegramBot from 'node-telegram-bot-api';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class TelegramService {
  private bot: any;

  constructor(
    private readonly loggerService: Logger,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {
    this.bot = new TelegramBot(this.configService.get('TELEGRAM_TOKEN'), {
      polling: false,
    });
    this.bot.on('message', this.process);
  }

  public async sendPhoto(chatId: string, photo: Buffer, caption: string) {
    return this.bot.sendPhoto(chatId, photo, { caption });
  }

  private process(msg: {
    chat: { id: any };
    reply_to_message: { message_id: any };
    text: any;
    message_id: any;
  }) {
    if (
      (msg.chat.id == this.configService.get('TELEGRAM_CHAT') ||
        msg.chat.id == this.configService.get('TELEGRAM_ALT_CHAT')) &&
      msg.reply_to_message?.message_id
    ) {
      const newWho = [...this.configService.get('NAME_MAPPINGS'), 'errado'].find(
        (w) => w == msg.text,
      );
      if (!newWho) return;
      this.storageService.listFiles(`message/${msg.reply_to_message.message_id}`).then((ids) => {
        if (ids.length != 1) {
          return this.bot.sendMessage(msg.chat.id, 'id not found :(', {
            reply_to_message_id: msg.message_id,
          });
        }
        const original = ids[0].split('-').at(-1);
        const name = this.configService
          .get('NAME_MAPPINGS')
          .filter((n: string) => original.includes(n));
        if (name.length != 1) {
          return this.bot.sendMessage(msg.chat.id, 'name not found :(', {
            reply_to_message_id: msg.message_id,
          });
        }
        if (name[0] == newWho) {
          return this.bot.sendMessage(msg.chat.id, "hey! it's the same I predicted!", {
            reply_to_message_id: msg.message_id,
          });
        }
        const ts = original.replace(name[0], '');
        const oldKey = `identified/${original}.jpeg`;
        this.storageService
          .download(oldKey)
          .then((file: Buffer): void => {
            this.storageService
              .delete(oldKey)
              .then(() =>
                this.storageService.upload(
                  file,
                  `identified/${newWho == 'errado' ? 'undefined' : newWho}${ts}.jpeg`,
                ),
              )
              .then(() =>
                this.bot.sendMessage(msg.chat.id, 'ooooh quei', {
                  reply_to_message_id: msg.message_id,
                }),
              );
          })
          .catch(() =>
            this.bot.sendMessage(msg.chat.id, 'already done', {
              reply_to_message_id: msg.message_id,
            }),
          );
      });
    }
  }
}