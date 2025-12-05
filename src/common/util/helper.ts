import { ThrottlerModuleOptions, ThrottlerOptions } from "@nestjs/throttler";
import { Secrets } from "../secrets";
import axios, { AxiosResponse } from "axios";

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
  const throttles: ThrottlerOptions[] = [
    {
      name: 'Seconds',
      ttl: 1000,
      limit: Secrets.RATE_LIMITING_PER_SECOND
    }, {
      name: 'Minutes',
      ttl: 60000,
      limit: Secrets.RATE_LIMITING_PER_MINUTE
    }
  ];

  return Secrets.NODE_ENV !== 'test' ? throttles : [];
};

export const fetchCoordinates = async (location: string): Promise<AxiosResponse> => {
  try {
    const locationParam = location.replace(/(,)/g, '').replace(/\s/g, '+');
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${locationParam}&format=json`, {
      headers: {
        'User-Agent': `${Secrets.APP_NAME}-${Secrets.APP_EMAIL}`
      }
    });

    return response;
  } catch (error) {
    throw error;
  }
}