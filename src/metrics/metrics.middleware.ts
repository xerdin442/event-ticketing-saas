import { Injectable, NestMiddleware } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    res.on('finish', () => {
      this.metricsService.incrementRequestCounter(
        req.method,
        req.path,
        res.statusCode.toString(),
      );
    });
    next();
  }
}
