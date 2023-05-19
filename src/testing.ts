import { Api } from './index.js';
import {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from '@netlify/functions';

export interface TestRequest<TBody = unknown> {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: TBody;
  params?: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ApiTestHarness<TApi extends Api<any>> {
  private api: TApi;
  constructor(api: TApi) {
    this.api = api;
  }

  async handleRequest(request: TestRequest): Promise<HandlerResponse> {
    const params = request.params ?? {};

    if (request.url.includes('?')) {
      const [url, queryString] = request.url.split('?');
      const query = new URLSearchParams(queryString);

      for (const [key, value] of query.entries()) {
        params[key] = value;
      }

      request.url = url;
    }

    return this.api.baseHandler(
      {
        httpMethod: request.method,
        path: request.url,
        headers: request.headers,
        body: request.body,
        queryStringParameters: params,
      } as HandlerEvent,
      {} as HandlerContext
    );
  }

  async get(url: string, headers: Record<string, string> = {}) {
    return this.handleRequest({
      method: 'GET',
      url,
      headers,
      body: null,
    });
  }
  async post<TBody>(
    url: string,
    body: TBody,
    headers: Record<string, string> = {}
  ) {
    return this.handleRequest({
      method: 'POST',
      url,
      headers,
      body,
    });
  }
  async put<TBody>(
    url: string,
    body: TBody,
    headers: Record<string, string> = {}
  ) {
    return this.handleRequest({
      method: 'PUT',
      url,
      headers,
      body,
    });
  }

  async patch<TBody>(
    url: string,
    body: TBody,
    headers: Record<string, string> = {}
  ) {
    return this.handleRequest({
      method: 'PATCH',
      url,
      headers,
      body,
    });
  }

  async delete(url: string, headers: Record<string, string> = {}) {
    return this.handleRequest({
      method: 'DELETE',
      url,
      headers,
      body: null,
    });
  }
}
