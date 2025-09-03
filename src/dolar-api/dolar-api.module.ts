import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DolarBaseService } from './core/services/dolar-base/dolar-base.service';

@Module({
    imports: [
        HttpModule.register({
            timeout: 10000,
            maxRedirects: 5,
        }),
        ConfigModule,
    ],
    providers: [DolarBaseService],
    exports: [DolarBaseService],
})
export class DolarApiModule { }