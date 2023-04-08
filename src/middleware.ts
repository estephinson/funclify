import { RouteMiddleware } from './types';
import { ZodSchema } from 'zod';

export const withBodyValidator =
  (schema: ZodSchema): RouteMiddleware =>
  async (req, context, next) => {
    if (!next) {
      throw new Error('next is not defined');
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return context.withStatus(400).withJSON({
        message: 'Invalid request body',
        errors: result.error.errors,
      });
    }

    return next();
  };

export const withQueryValidator =
  (schema: ZodSchema): RouteMiddleware =>
  async (req, context, next) => {
    if (!next) {
      throw new Error('next is not defined');
    }

    const result = schema.safeParse(req.query);
    if (!result.success) {
      return context.withStatus(400).withJSON({
        message: 'Invalid query params',
        errors: result.error.errors,
      });
    }

    return next();
  };

export const withCors =
  (origin: string): RouteMiddleware =>
  async (req, context, next) => {
    if (!next) {
      throw new Error('next is not defined');
    }

    const response = await next();

    return {
      ...response,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  };

export type AuthClaims = Record<string, string | undefined>;

export interface AuthProvider {
  verifyToken(token: string): Promise<AuthClaims>;
}

export const withAuth = (provider: AuthProvider): RouteMiddleware => {
  return async (req, context, next) => {
    if (!next) {
      throw new Error('next is not defined');
    }

    const { authorization } = req.headers;

    if (authorization) {
      const token = authorization.replace('Bearer ', '');
      const claims = await provider.verifyToken(token);
      req.context.claims = claims;
    }

    return next();
  };
};
