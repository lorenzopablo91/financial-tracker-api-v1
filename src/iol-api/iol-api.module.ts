import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { IolAuthService } from './auth/services/iol-auth/iol-auth.service';
import { IolBaseService } from './core/services/iol-base/iol-base.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [
    IolAuthService,
    IolBaseService,
  ],
  exports: [
    IolAuthService,
    IolBaseService,
  ],
})
export class IolApiModule {}