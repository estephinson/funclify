import { ZodSchema, z } from 'zod';
import { Request, ResponseContext } from './context';
import { UrlPattern } from './url-pattern';

export type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>;

export interface RouteResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface RouteRequest<
  T extends string = '',
  TQuerySchema extends ZodSchema | undefined = undefined
> {
  body: unknown;
  headers: Record<string, string>;
  method: string;
  query: TQuerySchema extends ZodSchema
    ? z.infer<TQuerySchema>
    : Record<string, string | undefined>;
  params: ExtractRouteParams<T>;
}

export type RouteHandler<
  T extends string = '',
  TQuerySchema extends ZodSchema | undefined = undefined
> = (
  request: Request<T, TQuerySchema>,
  context: ResponseContext,
  next?: () => Promise<RouteResponse>
) => Promise<RouteResponse>;

export type RouteMiddleware = RouteHandler<any, any>;

export interface InternalRouteHandler {
  method: string;
  urlPattern: UrlPattern;
  handlers: any[];
}

export interface RouteTree {
  middleware?: RouteHandler[];
  routeHandler?: InternalRouteHandler;
  children?: {
    [key: string]: RouteTree;
  };
}

export interface TreeSearchResult {
  matchedRoute: InternalRouteHandler;
  params: Record<string, string>;
  handlers: RouteHandler[];
}
