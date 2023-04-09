import {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from '@netlify/functions';
import { ZodSchema } from 'zod';

import { Request, ResponseContext } from './context';
import {
  ContextExtractor,
  IntegrationWrapper,
  RouteHandler,
  RouteMiddleware,
  RouteOptions,
} from './types';
import { LogLevel, Logger } from './logger';
import { RouteTreeEngine } from './route-tree';

export interface ApiOptions {
  logLevel: LogLevel;
}

const defaultOptions: ApiOptions = {
  logLevel: LogLevel.Info,
};

export class Api<
  TIntegrations extends IntegrationWrapper | undefined = undefined
> {
  private routeTree: RouteTreeEngine;
  private options: ApiOptions;
  private logger: Logger;

  constructor(options?: Partial<ApiOptions>) {
    this.options = { ...defaultOptions, ...options };

    const logger = new Logger(this.options.logLevel);
    this.logger = logger;

    this.routeTree = new RouteTreeEngine(logger);
  }

  public post<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      ContextExtractor<TIntegrations>
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
      ContextExtractor<TIntegrations>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'POST',
      url,
      handlers,
      options,
    });
  }

  public put<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      ContextExtractor<TIntegrations>
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
      ContextExtractor<TIntegrations>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'PUT',
      url,
      handlers,
      options,
    });
  }

  public patch<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      ContextExtractor<TIntegrations>
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
      ContextExtractor<TIntegrations>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'PATCH',
      url,
      handlers,
      options,
    });
  }

  public delete<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      ContextExtractor<TIntegrations>
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
      ContextExtractor<TIntegrations>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'DELETE',
      url,
      handlers,
      options,
    });
  }

  public get<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined
  >(
    url: TPath,
    ...handlers: RouteHandler<
      TPath,
      TQuerySchema,
      TBodySchema,
      ContextExtractor<TIntegrations>
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
      ContextExtractor<TIntegrations>
    >[]
  ) {
    this.routeTree.addRoute({
      method: 'GET',
      url,
      handlers,
      options,
    });
  }

  public use(url: string, ...handlers: RouteMiddleware[]) {
    this.routeTree.addMiddleware(url, handlers);
  }

  get baseHandler() {
    return async (
      event: HandlerEvent,
      context: HandlerContext
    ): Promise<HandlerResponse> => {
      let url = event.path;
      if (url.startsWith('/.netlify/functions/')) {
        url = url.substring('/.netlify/functions/'.length);
      }
      const method = event.httpMethod;

      const components = url.split('/').slice(1);
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
          try {
            body = JSON.parse(event.body);
          } catch (e) {
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
        const next = async () => {
          i++;
          return handlers[i - 1](req, responseContext, next);
        };

        const start = Date.now();

        const result = await next();

        const end = Date.now();
        const time = `${end - start}ms`;

        this.logger.info(`${method} ${url} ${result.statusCode} ${time}`);

        let headers = {
          'Content-Type': 'application/json',
        };

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
      }

      return {
        statusCode: 404,
      };
    };
  }
}
