# Funclify 🤖

Funclify is an **opinionated** framework for building APIs on Netlify Functions. It's fast, it's powerful and most importantly focused around a great developer experience.

## ⚠️ Just one thing!

Funclify is _very_ early on in it's development. It may be abandoned, it may be completely up-ended and rewriten in Rust 👀, so as much as I'd love to say use this in production, bear those things in mind.

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
