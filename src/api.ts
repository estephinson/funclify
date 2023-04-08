import { Handler } from '@netlify/functions';
import { ZodSchema } from 'zod';

import { Request, ResponseContext } from './context';
import {
  InternalRouteHandler,
  RouteHandler,
  RouteMiddleware,
  RouteTree,
  TreeSearchResult,
} from './types';
import { UrlPattern } from './url-pattern';
import { LogLevel, Logger } from './logger';

export interface ApiOptions {
  logLevel: LogLevel;
}

const defaultOptions: ApiOptions = {
  logLevel: LogLevel.Info,
};

export class Api {
  private routeTree: RouteTree;
  private options: ApiOptions;
  private logger: Logger;

  constructor(options?: Partial<ApiOptions>) {
    this.routeTree = {};
    this.options = { ...defaultOptions, ...options };

    const logger = new Logger(this.options.logLevel);
    this.logger = logger;
  }

  private addMiddleware(url: string, handlers: RouteHandler[]) {
    const components = url.split('/');
    let current = this.routeTree;

    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (component === '') {
        if (i === components.length - 1) {
          if (!current.middleware) {
            current.middleware = [];
          }

          current.middleware!.push(...handlers);
          return;
        }
        continue;
      }

      if (!current.children) {
        current.children = {};
      }

      if (i === components.length - 1) {
        if (current.children[component]) {
          if (!current.children[component].middleware) {
            current.children[component].middleware = [];
          }

          current.children[component].middleware!.push(...handlers);
        } else {
          current.children[component] = {
            middleware: handlers,
          };
        }
        return;
      }

      if (!current.children[component]) {
        current.children[component] = {};
      }

      current = current.children[component] as RouteTree;
    }
  }

  private addRoute(
    method: string,
    url: string,
    ...handlers: any[]
  ): InternalRouteHandler {
    const route: InternalRouteHandler = {
      method,
      urlPattern: new UrlPattern(url),
      handlers,
    };

    const components = url.split('/');
    let current = this.routeTree;

    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (component === '') {
        continue;
      }

      if (!current.children) {
        current.children = {};
      }

      if (i === components.length - 1) {
        if (current.children[component]) {
          current.children[component].routeHandler = route;
        } else {
          current.children[component] = {
            routeHandler: route,
          };
        }
        return route;
      }

      if (!current.children[component]) {
        current.children[component] = {};
      }

      current = current.children[component] as RouteTree;
    }

    return route;
  }

  post<
    TPath extends string,
    TQuerySchema extends ZodSchema | undefined = undefined
  >(url: TPath, ...handlers: RouteHandler<TPath, TQuerySchema>[]) {
    this.addRoute('POST', url, ...handlers);
  }

  get<
    TPath extends string,
    TQuerySchema extends ZodSchema | undefined = undefined
  >(url: TPath, ...handlers: RouteHandler<TPath, TQuerySchema>[]) {
    this.addRoute('GET', url, ...handlers);
  }

  use(url: string, ...handlers: RouteMiddleware[]) {
    this.addMiddleware(url, handlers);
  }

  recursiveTreeMatch(
    url: string,
    fullUrl: string,
    method: string,
    tree: RouteTree
  ): TreeSearchResult | undefined {
    const components = url.split('/').slice(1);
    const [current, ...rest] = components;

    // Try a direct match
    const node = tree.children?.[current];
    if (node) {
      this.logger.debug(`Node found for ${current}`);
      // If we're at the end of the URL, return the handlers
      if (node.routeHandler) {
        this.logger.debug(`Node is a route handler for ${current}`);
        if (rest.length === 0) {
          if (
            node.routeHandler.method === method &&
            node.routeHandler.urlPattern.match(fullUrl)
          ) {
            return {
              matchedRoute: node.routeHandler,
              params: node.routeHandler.urlPattern.parse(fullUrl),
              handlers: [
                ...(tree.middleware ?? []),
                ...(node.middleware ?? []),
                ...node.routeHandler.handlers,
              ].filter(Boolean),
            };
          }
        }
      }

      if (node.children) {
        this.logger.debug(`Node is a route tree for ${current}`);
        // If we're not at the end of the URL, recurse
        if (rest.length > 0) {
          this.logger.debug(
            `Recursing for ${current} with ${rest.join(', ')}...`
          );
          const nodeHandler = node.middleware;

          const result = this.recursiveTreeMatch(
            '/' + rest.join('/'),
            fullUrl,
            method,
            node
          );

          if (result) {
            result.handlers = [
              ...(tree.middleware ?? []),
              ...(nodeHandler ?? []),
              ...result.handlers,
            ];

            return result;
          }
        }
      }
    } else {
      this.logger.debug(`No node found for ${current}, trying arguments...`);
      const children = tree.children ?? {};
      // If no node, try an argument match
      const argumentNodes = Object.keys(children).filter((key) =>
        key.startsWith(':')
      );

      for (const argumentNodeKey of argumentNodes) {
        const argumentNode = children[argumentNodeKey];
        this.logger.debug(`Trying argument node ${argumentNode}...`);
        if (argumentNode.routeHandler) {
          this.logger.debug(`Node is a route handler for ${current}`);
          if (rest.length === 0) {
            if (
              argumentNode.routeHandler.method === method &&
              argumentNode.routeHandler.urlPattern.match(fullUrl)
            ) {
              return {
                matchedRoute: argumentNode.routeHandler,
                params: argumentNode.routeHandler.urlPattern.parse(fullUrl),
                handlers: [
                  ...(tree.middleware ?? []),
                  ...(argumentNode.middleware ?? []),
                  ...argumentNode.routeHandler.handlers,
                ].filter(Boolean),
              };
            }
          }
        }
        if (argumentNode.children) {
          this.logger.debug(`Node is a route tree for ${current}`);
          // If we're not at the end of the URL, recurse
          if (rest.length > 0) {
            this.logger.debug(
              `Recursing for ${current} with ${rest.join(', ')}...`
            );
            const middleware = argumentNode.middleware;

            const result = this.recursiveTreeMatch(
              '/' + rest.join('/'),
              fullUrl,
              method,
              argumentNode
            );

            if (result) {
              result.handlers = [
                ...(tree.middleware ?? []),
                ...(middleware ?? []),
                ...result.handlers,
              ];

              return result;
            }
          }
        }
      }
    }
  }

  get baseHandler(): Handler {
    return async (event, context) => {
      let url = event.path;
      if (url.startsWith('/.netlify/functions/')) {
        url = url.substring('/.netlify/functions/'.length);
      }
      const method = event.httpMethod;

      const components = url.split('/').slice(1);
      url = '/' + components.join('/');
      const current = this.routeTree;

      const start = process.hrtime();
      const match = this.recursiveTreeMatch(url, url, method, current);
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
