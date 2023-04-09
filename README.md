# Funclify 🤖

Funclify is an **opinionated** framework for building APIs on Netlify Functions. It's fast, it's powerful and most importantly focused around a great developer experience.

Currently, this is a **TypeScript-only** framework. This reflects the current focus of the project, being a type-safe and DX focused package, and in the future it may be updated to compile to support ESM. It's early days, so please forgive the narrow-focus.

## ⚠️ Just one thing!

Funclify is _very_ early on in it's development. It may be abandoned, it may be completely up-ended and rewriten in Rust 👀, so as much as I'd love to say use this in production, bear those things in mind.

## Install

```shell
# pnpm
pnpm add funclify

# npm
npm install funclify
```

## Basic Use

Funclify includes an `API` class which is the entry point for both defining handlers and also processing requests.

```ts
// netlify/functions/api.ts
import { Api } from 'funclify';

const api = new Api();

api.get("/", async (_, res) => {
    return res.withJSON({ message: "Hello World!" });
});

export const handler = api.baseHandler;
```

## Testing

Funclify comes bundled with a test harness to make it simple to run integration tests against your API.

Although you could adopt a more "unit" approach, the framework is built to encourage testing to the boundary of your application for each and every API route.

An example below utilising Vitest

```ts
import { describe, it, beforeEach, expect } from "vitest";
import { ApiTestHarness } from "funclify";
import { api } from "../functions/api";

describe("API", () => {
  let test: ApiTestHarness<typeof api>;

  beforeEach(() => {
    // This could be set once rather than in before-each, as
    // in theory an API should be idempotent. However, for flexibility
    // atomicity can be guaranteed by initialising in the beforeEach
    test = new ApiTestHarness(api);
  });

  it("should return a user object", async () => {
    // Perform the request. Under the hood, this
    // emulates the `event` and `context` fed in
    // from a Netlify Function
    const response = await test.get("/user/123");

    expect(response.statusCode).toBe(200);

    // Regardless of your application output, the response
    // from a Netlify Function will be a string, so we need
    // to parse into JSON to assert on the returned objects
    expect(response.body).toBeTypeOf("string");

    const body = JSON.parse(response.body!);
    expect(body).toContain({
      id: "123",
      name: "Ed",
    });
  });
});
```
