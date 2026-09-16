import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const isDev = process.env.APP_ENV !== 'production';

// ponytail: no Observe credentials in dev, so skip registering it there
// instead of letting it start up and reject against the collector.
const observeImports = isDev
  ? []
  : [
      ObserveModule.forRoot({
        appKey: process.env.OBSERVE_APP_KEY ?? '',
        appSecret: process.env.OBSERVE_APP_SECRET ?? '',
        serviceId: 'nest-typescript-starter',
      }),
    ];

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ...observeImports,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
        transport: isDev
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
      },
    }),
    PrismaModule,
    AuthModule,
    DashboardModule,
  ],
})
export class AppModule {}
