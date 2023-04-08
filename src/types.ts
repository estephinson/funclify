import { ZodSchema, z } from 'zod';
import { Request, ResponseContext } from './context';
import { UrlPattern } from './url-pattern';
import { HandlerContext } from '@netlify/functions';

export type IntegrationWrapper = (a: any, b?: any) => any;

export type ContextExtractor<T extends IntegrationWrapper | undefined> =
  T extends (a: infer Handler, b?: infer _Config) => infer _Res
    ? Handler extends (a: infer _Req, b: infer Ctx) => Promise<infer _Res>
      ? Ctx
      : never
    : HandlerContext;

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
  TQuerySchema extends ZodSchema | undefined = undefined,
  TContext extends HandlerContext = HandlerContext
> {
  body: unknown;
  headers: Record<string, string>;
  method: string;
  query: TQuerySchema extends ZodSchema
    ? z.infer<TQuerySchema>
    : Record<string, string | undefined>;
  params: ExtractRouteParams<T>;
  context: TContext;
}

export type RouteHandler<
  T extends string = '',
  TQuerySchema extends ZodSchema | undefined = undefined,
  TBodySchema extends ZodSchema | undefined = undefined,
  TContext extends HandlerContext = HandlerContext
> = (
  request: Request<T, TQuerySchema, TBodySchema, TContext>,
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
