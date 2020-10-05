import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { flatten } from 'flat';

import { ConfigService } from '../config/config.service';
import { LoggerLevel } from '../logger/logger.enum';
import { LoggerParams, LoggerTransport } from '../logger/logger.interface';
import { LoggerTransportOptions } from '../logger/logger.interface/logger.transport.options';
import { LoggerService } from '../logger/logger.service';
import { SentryConfig } from './sentry.config';

@Injectable()
export class SentryService implements LoggerTransport {

  public constructor(
    protected readonly configService: ConfigService<SentryConfig>,
    protected readonly loggerService: LoggerService,
  ) {
    this.loggerService.registerTransport(this);
    this.setupTransport();
  }

  /**
   * Creates a connection to Sentry transport, disables
   * the native uncaught exception integration since we
   * are customizing it at logger service.
   */
  private setupTransport(): void {
    const options = this.getOptions();
    if (!options?.level && options?.level !== 0) return;

    const dsn = this.configService.get('SENTRY_DSN');
    if (!dsn) {
      throw new InternalServerErrorException('expected SENTRY_DSN to be an URL');
    }

    Sentry.init({
      dsn,
      environment: options.environment,
      integrations: (int) => int.filter((i) => i.name !== 'OnUncaughtException'),
    });
    this.loggerService.notice(`Sentry transport connected at ${dsn}`);
  }

  /**
   * Returns the options array for this logging transport.
   */
  public getOptions(): LoggerTransportOptions {
    const environment = this.configService.get('NODE_ENV');
    const options = this.configService.get('SENTRY_TRANSPORT_OPTIONS');
    return options.find((o) => o.environment === environment);
  }

  /**
   * Sends a log message to Sentry configuring
   * custom data and labels.
   * @param params
   */
  public log(params: LoggerParams): void {

    if (params.message !== params.error.message) {
      params.error.message = `${params.message}. ${params.error.message}`;
    }

    Sentry.withScope((scope) => {
      scope.setLevel(this.getSentrySeverity(params.level));
      if (params.data?.unexpected) scope.setTag('unexpected', 'true');
      scope.setExtras(flatten(params.data));
      Sentry.captureException(params.error);
    });

  }

  /**
   * Translates application log level into sentry severity.
   * @param level
   */
  public getSentrySeverity(level: LoggerLevel): Sentry.Severity {
    switch (level) {
      case LoggerLevel.CRITICAL: return Sentry.Severity.Critical;
      case LoggerLevel.ERROR: return Sentry.Severity.Error;
      case LoggerLevel.WARNING: return Sentry.Severity.Warning;
      case LoggerLevel.NOTICE: return Sentry.Severity.Info;
      case LoggerLevel.INFO: return Sentry.Severity.Info;
      case LoggerLevel.HTTP: return Sentry.Severity.Debug;
      case LoggerLevel.DEBUG: return Sentry.Severity.Debug;
    }
  }

}
