import * as http from "http";
import express from "express";
import expressCore from "express-serve-static-core";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";
import morgan from "morgan";
import { ErrorResponse } from "../types/api";
import reactMiddleware from "./helpers/reactHelper";
import HTTPError from "./helpers/HTTPError";
import { router as apiRouter } from "./api";
import { router as pagesRouter } from "./pages";

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(compression());
app.use('/static', express.static('static'));
app.use('/library', express.static('library'));
if(process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  app.use(require('./helpers/webpackHelper').mount());
} else {
  app.use('/client.js', express.static('client.js'));
  app.use('/style.css', express.static('style.css'));
}

app.use(reactMiddleware);

app.use('/api', apiRouter);
app.use('/', pagesRouter);

app.use((req, res, next) => {
  next(new HTTPError(404));
});

app.use((err: Partial<HTTPError>, req: expressCore.RequestEx<any, any, any>, res: expressCore.ResponseEx<ErrorResponse>, _next: expressCore.NextFunction) => {
  if(err.HTTPcode !== 404) console.error(err);
  
  const code = err.HTTPcode || 500;
  const result = {
    _error: {
      code,
      message: err.publicMessage || http.STATUS_CODES[code] || "Something Happened",
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  };
  if("react" in res) res.status(code).react(result);
  else (res as expressCore.Response).status(code).json(result);
});

export default app;
