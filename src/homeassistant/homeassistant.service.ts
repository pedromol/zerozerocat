import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { Logger } from 'nestjs-pino';
import { catchError, firstValueFrom, Observable, ObservableInput } from 'rxjs';

@Injectable()
export class HomeassistantService {
    constructor(
        private readonly loggerService: Logger,
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) { }

    async update(entity: string, state: string): Promise<void> {
        const oldState = await firstValueFrom(
            this.httpService.get(this.configService.get('HASS_ENDPOINT') + '/api/states/person.' + entity,
                {
                    headers: {
                        'Authorization': 'Bearer ' + this.configService.get('HASS_TOKEN'),
                        'Content-Type': 'application/json',
                    },
                }).pipe(
                    catchError((error: AxiosError) => {
                        this.loggerService.error(`HASS error response: ${JSON.stringify(error?.response?.data)}`);
                        return new Observable()
                    }),
                ),
        ) as any;
        await firstValueFrom(
            this.httpService.post(this.configService.get('HASS_ENDPOINT') + '/api/states/person.' + entity,
                { ...oldState.data, state: state },
                {
                    headers: {
                        'Authorization': 'Bearer ' + this.configService.get('HASS_TOKEN'),
                        'Content-Type': 'application/json',
                    },
                }).pipe(
                    catchError((error: AxiosError) => {
                        this.loggerService.error(`HASS error response: ${JSON.stringify(error?.response?.data)}`);
                        return new Observable()
                    }),
                ),
        );
    }
}
