import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AppController {
  @Get('health')
  check(@Res() res: Response) {
    return res.status(HttpStatus.OK).send('Service is healthy!');
  }
}
