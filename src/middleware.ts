import { RouteMiddlewareInitialiser } from './types.js';
import { ZodSchema } from 'zod';

export const withBodyValidator: RouteMiddlewareInitialiser<ZodSchema> =
  (schema: ZodSchema) => async (req, res, next) => {
    if (!next) {
      throw new Error('next is not defined');
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.withStatus(400).withJSON({
        message: 'Invalid request body',
        errors: (result as any).error.errors,
      });
    }

    return next(req, res);
  };

export const withQueryValidator: RouteMiddlewareInitialiser<ZodSchema> =
  (schema: ZodSchema) => async (req, res, next) => {
    if (!next) {
      throw new Error('next is not defined');
    }

    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.withStatus(400).withJSON({
        message: 'Invalid query params',
        errors: (result as any).error.errors,
      });
    }

    return next(req, res);
  };

type CorsOptions = {
  origin: string;
};

export const withCors: RouteMiddlewareInitialiser<CorsOptions> =
  ({ origin }) =>
  async (req, res, next) => {
    if (!next) {
      throw new Error('next is not defined');
    }

    const response = await next(req, res);

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

type AuthOptions = {
  provider: AuthProvider;
};

export const withAuth: RouteMiddlewareInitialiser<AuthOptions> = ({
  provider,
}) => {
  return async (req, res, next) => {
    if (!next) {
      throw new Error('next is not defined');
    }

    const { authorization } = req.headers;

    if (authorization) {
      const token = authorization.replace('Bearer ', '');
      const claims = await provider.verifyToken(token);
      req.context.claims = claims;
    }

    return next(req, res);
  };
};
