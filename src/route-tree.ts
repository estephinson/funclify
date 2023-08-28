import { HandlerContext } from '@netlify/functions';
import { withBodyValidator, withQueryValidator } from './middleware.js';
import {
  InternalRouteHandler,
  Method,
  RouteHandler,
  RouteOptions,
  RouteTree,
  TreeSearchResult,
} from './types.js';
import { UrlPattern } from './url-pattern.js';
import { ZodSchema } from 'zod';
import { Logger } from './logger.js';

export class RouteTreeEngine {
  private routeTree: RouteTree;
  private logger: Logger;

  constructor(logger: Logger) {
    this.routeTree = {};
    this.logger = logger;
  }

  public addMiddleware(url: string, handlers: RouteHandler<any>[]) {
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

  public addRoute<
    TPath extends string = '',
    TQuerySchema extends ZodSchema | undefined = undefined,
    TBodySchema extends ZodSchema | undefined = undefined,
    TContext extends HandlerContext = HandlerContext
  >({
    method,
    url,
    handlers,
    options,
  }: {
    method: Method;
    url: TPath;
    handlers: RouteHandler<TPath, TQuerySchema, TBodySchema, TContext>[];
    options?: RouteOptions<TBodySchema, TQuerySchema>;
  }): InternalRouteHandler {
    let routeUrl = url;
    if (url !== '/' && url.endsWith('/')) {
      routeUrl = url.slice(0, -1) as TPath;
    }
    const route: InternalRouteHandler = {
      urlPattern: new UrlPattern(routeUrl),
      handlers,
    };

    if (options?.bodySchema) {
      handlers.unshift(withBodyValidator(options.bodySchema) as any);
    }
    if (options?.querySchema) {
      handlers.unshift(withQueryValidator(options.querySchema) as any);
    }

    if (!this.routeTree.routeHandlers) {
      this.routeTree.routeHandlers = {};
    }

    if (routeUrl === '/') {
      this.routeTree.routeHandlers[method] = route;
      return route;
    }

    const components = routeUrl.split('/');
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
          const currentChild = current.children[component];
          if (!currentChild.routeHandlers) {
            currentChild.routeHandlers = {};
          }
          currentChild.routeHandlers[method] = route;
        } else {
          current.children[component] = {
            routeHandlers: { [method]: route },
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

  public recursiveTreeMatch(
    url: string,
    fullUrl: string,
    method: Method,
    tree: RouteTree = this.routeTree
  ): TreeSearchResult | undefined {
    const components = url.split('/').slice(1);
    const [current, ...rest] = components;

    if (url === '/') {
      if (tree.routeHandlers) {
        const potentialMatch = tree.routeHandlers[method];
        if (potentialMatch && potentialMatch.urlPattern.match(fullUrl)) {
          return {
            matchedRoute: potentialMatch,
            params: potentialMatch.urlPattern.parse(fullUrl),
            handlers: potentialMatch.handlers,
          };
        }
      }
    }

    // Try a direct match
    const node = tree.children?.[current];
    if (node) {
      this.logger.debug(`Node found for ${current}`);
      // If we're at the end of the URL, return the handlers
      if (node.routeHandlers) {
        this.logger.debug(`Node is a route handler for ${current}`);
        if (rest.length === 0) {
          const potentialMatch = node.routeHandlers[method];
          if (potentialMatch && potentialMatch.urlPattern.match(fullUrl)) {
            return {
              matchedRoute: potentialMatch,
              params: potentialMatch.urlPattern.parse(fullUrl),
              handlers: [
                ...(tree.middleware ?? []),
                ...(node.middleware ?? []),
                ...potentialMatch.handlers,
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
        if (argumentNode.routeHandlers) {
          this.logger.debug(`Node is a route handler for ${current}`);
          const potentialMatch = argumentNode.routeHandlers[method];
          if (rest.length === 0) {
            if (potentialMatch && potentialMatch.urlPattern.match(fullUrl)) {
              return {
                matchedRoute: potentialMatch,
                params: potentialMatch.urlPattern.parse(fullUrl),
                handlers: [
                  ...(tree.middleware ?? []),
                  ...(argumentNode.middleware ?? []),
                  ...potentialMatch.handlers,
                ].filter(Boolean),
              };
            } else {
              this.logger.debug(
                `Method or URL pattern did not match for ${current}`
              );
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

  public GetAllRoutes(): InternalRouteHandler[] {
    const routes: InternalRouteHandler[] = [];

    const recurse = (tree: RouteTree) => {
      if (tree.routeHandlers) {
        routes.push(...Object.values(tree.routeHandlers));
      }

      if (tree.children) {
        for (const child of Object.values(tree.children)) {
          recurse(child);
        }
      }
    };

    recurse(this.routeTree);

    return routes;
  }
}
