import { ZodSchema, z } from 'zod';
import { ExtractRouteParams, RouteRequest, RouteResponse } from './types';
import { HandlerContext } from '@netlify/functions';

export interface RequestContext {
  claims?: Record<string, string | undefined>;
}

export class Request<
  TPath extends string,
  TQuery extends ZodSchema | undefined = undefined,
  TBodySchema extends ZodSchema | undefined = undefined,
  TContext extends HandlerContext = HandlerContext
> implements RouteRequest<TPath, TQuery, TBodySchema, TContext>
{
  body: TBodySchema extends ZodSchema ? z.infer<TBodySchema> : unknown;
  headers: Record<string, string>;
  method: string;
  query: TQuery extends ZodSchema
    ? z.infer<TQuery>
    : Record<string, string | undefined>;
  params: ExtractRouteParams<TPath>;
  context: RequestContext & TContext;

  constructor(options: RouteRequest<TPath, TQuery, TBodySchema, TContext>) {
    this.body = options.body;
    this.headers = options.headers;
    this.method = options.method;
    this.query = options.query;
    this.params = options.params;

    this.context = options.context;
  }

  queryFrom<T extends ZodSchema>(schema: T): z.infer<T> {
    const res = schema.safeParse(this.query);
    if (res.success) {
      return res.data;
    } else {
      throw new Error('Invalid query params');
    }
  }

  bodyFrom<T extends ZodSchema>(schema: T): z.infer<T> {
    const res = schema.safeParse(this.body);
    if (res.success) {
      return res.data;
    } else {
      throw new Error('Invalid body');
    }
  }
}

export class ResponseContext implements RouteResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string> | undefined;

  constructor() {
    this.statusCode = 200;
    this.body = '';
    this.headers = {};
  }

  withJSON<T>(body: T): ResponseContext {
    this.body = body;
    this.headers = {
      'Content-Type': 'application/json',
    };
    return this;
  }

  withText(body: string): ResponseContext {
    this.body = body;
    this.headers = {
      'Content-Type': 'text/plain',
    };
    return this;
  }

  withRedirect(url: string): ResponseContext {
    this.statusCode = 302;
    this.headers = {
      Location: url,
    };
    return this;
  }

  withStatus(statusCode: number): ResponseContext {
    this.statusCode = statusCode;
    return this;
  }

  withHeaders(headers: Record<string, string>): ResponseContext {
    this.headers = {
      ...this.headers,
      ...headers,
    };
    return this;
  }
}
