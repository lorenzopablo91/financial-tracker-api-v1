import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthTokenService } from './auth/services/auth-token/auth-token.service';
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
    AuthTokenService,
    IolBaseService,
  ],
  exports: [
    AuthTokenService,
    IolBaseService,
  ],
})
export class IolApiModule {}