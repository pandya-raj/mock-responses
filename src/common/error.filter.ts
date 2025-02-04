import { ExceptionFilter, Catch, HttpException, ArgumentsHost, HttpStatus } from '@nestjs/common';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost) {
    let req = host.switchToHttp().getRequest();
    let res = host.switchToHttp().getResponse();
    let status = (error instanceof HttpException) ? error.getStatus(): HttpStatus.INTERNAL_SERVER_ERROR;

    if (status === HttpStatus.UNAUTHORIZED) {
      return res.status(status).send('');
    } else if (status === HttpStatus.NOT_FOUND) {
      return res.status(status).send('');
    } else if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      return res.status(status).send(`<pre>${error.stack}</pre>`); 
    } else {
      return res.status(status).send(`<pre>${error.stack}</pre>`); 
    }
  }
}