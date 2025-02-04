import * as path from 'path';
import * as hbs from 'hbs';
import * as fs from 'fs';
import * as yargs from 'yargs';

import * as express from 'express';
import * as morgan from 'morgan';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { BetterSqlite3 } from './common/better-sqlite3';
import { ErrorFilter } from './common/error.filter';

import { serveMockResponse } from './common/mock-response.middleware';

const argv = yargs
  .usage(
    `Usage: $0 --https --db-path [path] --port [num] --assets --ssl` +
    ` --cookie='MY_SESSION=123456789; Path=/'` +
    ` --headers='Access-Control-Allow-Headers=Content-Type, Authorization, X-Requested-With' `
  )
  .describe('db-path', 'Sqlite3 file path')
  .describe('ssl', 'run https server')
  .describe('port', 'port number')
  .describe('cookie', 'response cookie value')
  .option('headers', {
    type: 'array',
    desc: 'One or more custom headers'
  })
  .help('h').argv;

const config = getConfig(argv);
console.log('[mock-responses] yargs argv', argv, config);
if (!config.dbPath) throw `Invalid sqlite3 path ${argv['db-path']}`;
BetterSqlite3.initialize(config.dbPath);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions: config.httpsOptions
  });

  app.use(morgan('[mock-responses] :method :url :status :res[content-length] - :response-time ms'));
  app.use(bodyParser.json({limit: '50mb'}));
  app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
  app.use(cookieParser());
  app.use( function(req, res, next) { 
    const origin = req.headers['origin'];
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
      res.setHeader('Access-Control-Allow-Credentials', true);
    }

    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // ser custom headers
    if (argv.headers) {
      argv.headers.forEach((header: string) => {
        const [key, value] = header.split('=');
        value && res.setHeader(key, value);
      })
    }

    // ser custom cookies
    if (argv.cookie) {
      const [_, name, value] = (<string>argv.cookie).match(/^([a-z_]+)=(.*)/i);
      if (!req.cookies[name]) {
        res.setHeader('Set-Cookie', `${name}=${value}`);
      }
    }

    next();
    return;
  });
  app.use(serveMockResponse);
  app.use(express.static(path.join(__dirname, 'assets')));

  // app.useStaticAssets(path.join(__dirname, 'assets'));
  app.setBaseViewsDir(path.join(__dirname, 'assets', 'views')); // views for nestjs
  hbs.registerPartials(path.join(__dirname, 'assets', 'views'));  // views for hbs

  app.setViewEngine('hbs');
  app.useGlobalFilters(new ErrorFilter())

  await app.listen(config.port);
  console.log(`[mock-responses] starting server with port ${config.port}.`);
}

function getConfig(argv) {
  const config: any = {};
  const demoPath1 = path.join(__dirname, 'demo');
  const demoPath2 = path.join(__dirname, '..', 'demo');
  const demoDirPath = 
    (fs.existsSync(demoPath1) && demoPath1) || (fs.existsSync(demoPath2) && demoPath2) || path.join(__dirname);

  const usrPath = path.resolve(<string>(argv['db-path']) || demoDirPath);
  if (fs.existsSync(usrPath) && fs.lstatSync(usrPath).isDirectory()) {
    const dbPath = path.join(usrPath, 'mock-responses.sql');
    config.dbPath = fs.existsSync(dbPath) ? dbPath : null;
  } else if (fs.existsSync(usrPath) && fs.lstatSync(usrPath).isFile()) {
    config.dbPath = usrPath;
  }

  config.port = parseInt(<any>argv.port) || 3000;

  if (argv.ssl) {
    const key = fs.readFileSync(path.join(__dirname, '..', 'demo', 'server.key'))
    const cert = fs.readFileSync(path.join(__dirname, '..', 'demo', 'server.cert'))
    config.httpsOptions = {key, cert};
  }

  return config;
}

bootstrap();
