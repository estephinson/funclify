import { Api } from './index';
import { HandlerEvent, HandlerResponse } from '@netlify/functions';

export interface TestRequest<TBody = unknown> {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: TBody;
  params?: Record<string, string>;
}

export class ApiTestHarness<TApi extends Api<any>> {
  private api: TApi;
  constructor(api: TApi) {
    this.api = api;
  }

  async handleRequest(request: TestRequest): Promise<HandlerResponse> {
    return this.api.baseHandler(
      {
        httpMethod: request.method,
        path: request.url,
        headers: request.headers,
        body: request.body,
        queryStringParameters: request.params ?? {},
      } as HandlerEvent,
      {} as any
    );
  }

  async get(url: string) {
    return this.handleRequest({
      method: 'GET',
      url,
      headers: {},
      body: null,
    });
  }
  async post(url: string, body: any) {
    return this.handleRequest({
      method: 'POST',
      url,
      headers: {},
      body,
    });
  }
  async put(url: string, body: any) {
    return this.handleRequest({
      method: 'PUT',
      url,
      headers: {},
      body,
    });
  }
  async delete(url: string) {
    return this.handleRequest({
      method: 'DELETE',
      url,
      headers: {},
      body: null,
    });
  }
}
