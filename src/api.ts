import {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from '@netlify/functions';
import { ZodSchema } from 'zod';

import { Request, ResponseContext } from './context.js';
import {
  Method,
  RouteContext,
  RouteHandler,
  RouteMiddleware,
  RouteOptions,
  RouteRequest,
  RouteResponse,
} from './types.js';
import { LogLevel, Logger } from './logger.js';
import { RouteTreeEngine } from './route-tree.js';

export interface ApiOptions {
  logLevel: LogLevel;
  /** An alternative string to `/.netlify/functions/` that should be removed from the start of a request.
   *
   * This is useful if you're using rewrites to mask the Netlify Function path.
   */
  prefix: `/${string}/`;
  onError?: (
    req: RouteRequest,
    ctx: ResponseContext,
    error: unknown
  ) => Promise<RouteResponse>;
}

const defaultOptions: ApiOptions = {
  logLevel: LogLevel.Info,
  prefix: '/.netlify/functions/',
};

export class Api<RequestContext extends HandlerContext = HandlerContext> {
  private routeTree: RouteTreeEngine;
  private options: ApiOptions;
  private logger: Logger;

  constructor(options?: Partial<ApiOptions>) {
    this.options = { ...defaultOptions, ...options };

    const logger = new Logger(this.options.logLevel);
    this.logger = logger;

    this.routeTree = new RouteTreeEngine(logger);
  }

  public withMiddleware<TContext>(
    middleware: RouteMiddleware<'/', TContext & RequestContext, RequestContext>
  ): Api<TContext & RequestContext> {
    this.use('/', middleware);

    return this as unknown as Api<TContext & RequestContext>;
  }

  public post<TPath extends string = ''>(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      undefined,
      undefined,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'POST',
      url,
      handlers,
    });
  }

  public postWithOptions<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    options: RouteOptions<TBodySchema, TQuerySchema>,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'POST',
      url,
      handlers,
      options,
    });
  }

  public put<TPath extends string = ''>(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      undefined,
      undefined,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'PUT',
      url,
      handlers,
    });
  }

  public putWithOptions<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    options: RouteOptions<TBodySchema, TQuerySchema>,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'PUT',
      url,
      handlers,
      options,
    });
  }

  public patch<TPath extends string = ''>(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      undefined,
      undefined,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'PATCH',
      url,
      handlers,
    });
  }

  public patchWithOptions<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    options: RouteOptions<TBodySchema, TQuerySchema>,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'PATCH',
      url,
      handlers,
      options,
    });
  }

  public delete<TPath extends string = ''>(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      undefined,
      undefined,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'DELETE',
      url,
      handlers,
    });
  }

  public deleteWithOptions<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    options: RouteOptions<TBodySchema, TQuerySchema>,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'DELETE',
      url,
      handlers,
      options,
    });
  }

  public get<TPath extends string = ''>(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      undefined,
      undefined,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'GET',
      url,
      handlers,
    });
  }

  public getWithOptions<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    options: RouteOptions<TBodySchema, TQuerySchema>,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      RouteContext<RequestContext>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'GET',
      url,
      handlers,
      options,
    });
  }

  public use<TPath extends string>(
    url: TPath,
    ...handlers: RouteMiddleware<TPath, any>[]
  ) {
    this.routeTree.addMiddleware(url, handlers);
  }

  get baseHandler() {
    return async (
      event: HandlerEvent,
      context: HandlerContext
    ): Promise<HandlerResponse> => {
      let url = event.path;
      if (url.startsWith(this.options.prefix)) {
        url = url.substring(this.options.prefix.length);
      }
      const method = event.httpMethod as Method;

      let components = url.split('/');
      if (this.options.prefix === defaultOptions.prefix) {
        components = components.slice(1);
      }
      url = '/' + components.join('/');

      const start = process.hrtime();
      const match = this.routeTree.recursiveTreeMatch(url, url, method);
      const end = process.hrtime(start);

      this.logger.debug(
        `Matched route in ${end[0] * 1e9 + end[1]} nanoseconds`
      );

      this.logger.debug(
        `Matched route has handlers: ${match?.handlers.length}`
      );

      if (match) {
        const { params, handlers } = match;

        let body: any = null;
        if (event.body) {
          const contentType =
            event.headers['content-type'] || event.headers['Content-Type'];

          switch (contentType?.split(';')[0].toLowerCase()) {
            case '':
            case undefined:
              try {
                body = JSON.parse(event.body);
              } catch (e) {
                body = event.body;
              }
              break;
            case 'application/json':
              try {
                body = JSON.parse(event.body);
              } catch (e) {
                this.logger.error(`Failed to parse JSON body - ${e}`);

                return {
                  statusCode: 400,
                  body: 'Invalid JSON body',
                };
              }
              break;
            default:
              body = event.body;
          }
        }

        const req = new Request<any, any>({
          method,
          body,
          headers: event.headers as Record<string, string>,
          query: event.queryStringParameters as Record<string, string>,
          params,
          context,
        });

        const responseContext = new ResponseContext();

        let i = 0;
        const next = async (
          request: Request<any, any>,
          response: ResponseContext
        ) => {
          i++;
          return handlers[i - 1](request, response, next);
        };

        const start = Date.now();

        try {
          const result = await next(req, responseContext);
          const end = Date.now();
          const time = `${end - start}ms`;

          this.logger.info(`${method} ${url} ${result.statusCode} ${time}`);

          let headers = {};

          if (result.headers) {
            headers = {
              ...headers,
              ...result.headers,
            };
          }
          return {
            statusCode: result.statusCode,
            body: JSON.stringify(result.body),
            headers,
          };
        } catch (e) {
          this.logger.error(`${method} ${url} - ${e}`);

          if (this.options.onError) {
            const result = await this.options.onError(
              req as any,
              responseContext,
              e
            );

            return {
              statusCode: result.statusCode,
              body: JSON.stringify(result.body),
              headers: result.headers,
            };
          }

          return {
            statusCode: 500,
            body: 'An unknown error occurred',
          };
        }
      }

      return {
        statusCode: 404,
      };
    };
  }
}
