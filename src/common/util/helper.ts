import { ThrottlerModuleOptions } from "@nestjs/throttler";
import { Secrets } from "../secrets";

export const formatDate = (date: Date, output: 'date' | 'time'): string => {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  };

  if (output === 'date') {
    options.year = 'numeric';
    options.month = 'long';
    options.day = 'numeric';
  }

  return new Intl.DateTimeFormat('en-US', options).format(date);
};

export const applyThrottlerConfig = (): ThrottlerModuleOptions => {
  const throttles = [{
    name: 'Seconds',
    ttl: 1000,
    limit: Secrets.RATE_LIMITING_PER_SECOND
  }, {
    name: 'Minutes',
    ttl: 60000,
    limit: Secrets.RATE_LIMITING_PER_MINUTE
  }];

  return Secrets.NODE_ENV !== 'test' ? throttles : [];
};