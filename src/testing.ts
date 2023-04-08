import { Api } from './index';

export class ApiTestHarness {
  private api: Api;
  constructor(api: Api) {
    this.api = api;
  }

  async handleRequest(request: Request) {
    this.api.baseHandler(
      {
        httpMethod: request.method,
        path: request.url,
        headers: request.headers,
        body: request.body,
      } as any,
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
