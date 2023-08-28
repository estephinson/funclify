import { ZodSchema, z } from 'zod';
import { Request, ResponseContext } from './context.js';
import { UrlPattern } from './url-pattern.js';
import { HandlerContext } from '@netlify/functions';

export type IntegrationWrapper = (a: any, b?: any) => any;

export type RouteContext<T> = HandlerContext & T;

export type IntegrationContextExtractor<
  T extends IntegrationWrapper | undefined
> = T extends (a: infer Handler, b?: infer _Config) => infer _Res
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

export interface RouteOptions<
  BodySchema extends ZodSchema | undefined = undefined,
  QuerySchema extends ZodSchema | undefined = undefined
> {
  bodySchema?: BodySchema;
  querySchema?: QuerySchema;
}

export interface RouteResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface RouteRequest<
  TUrl extends string = '',
  TQuerySchema extends ZodSchema | undefined = undefined,
  TBodySchema extends ZodSchema | undefined = undefined,
  TContext extends HandlerContext = HandlerContext
> {
  body: TBodySchema extends ZodSchema ? z.infer<TBodySchema> : unknown;
  headers: Record<string, string>;
  method: string;
  query: TQuerySchema extends ZodSchema
    ? z.infer<TQuerySchema>
    : Record<string, string | undefined>;
  params: ExtractRouteParams<TUrl>;
  context: TContext;
}

export type NextHandler<
  TPath extends string,
  TQuerySchema extends ZodSchema | undefined,
  TBodySchema extends ZodSchema | undefined,
  TContext extends HandlerContext
> = (
  req: Request<TPath, TQuerySchema, TBodySchema, TContext>,
  context: ResponseContext
) => Promise<RouteResponse>;

export type RouteHandler<
  TPath extends string = '',
  TQuerySchema extends ZodSchema | undefined = undefined,
  TBodySchema extends ZodSchema | undefined = undefined,
  TContextIn extends HandlerContext = HandlerContext,
  TContextOut extends HandlerContext = TContextIn
> = (
  request: Request<TPath, TQuerySchema, TBodySchema, TContextIn>,
  context: ResponseContext,
  next?: NextHandler<TPath, TQuerySchema, TBodySchema, TContextOut>
) => Promise<RouteResponse>;

export type RouteMiddlewareInitialiser<TOptions> = <TPath extends string>(
  options: TOptions
) => RouteMiddleware<TPath>;

export type RouteMiddleware<
  TPath extends string,
  TContextOut extends HandlerContext = any,
  TContext extends HandlerContext = any
> = RouteHandler<TPath, any, any, TContext, TContextOut>;

export interface InternalRouteHandler {
  urlPattern: UrlPattern;
  handlers: any[];
}

export type Method =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export interface RouteTree {
  middleware?: RouteHandler[];
  routeHandlers?: Partial<Record<Method, InternalRouteHandler>>;
  children?: {
    [key: string]: RouteTree;
  };
}

export interface TreeSearchResult {
  matchedRoute: InternalRouteHandler;
  params: Record<string, string>;
  handlers: RouteHandler[];
}
