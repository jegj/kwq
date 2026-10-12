import type { FastifyHelmetOptions } from '@fastify/helmet';

// 'unsafe-eval': Alpine's standard build evaluates x-data/x-on expressions.
// 'unsafe-inline' (styles only): templates use style="" attributes.
// img-src https: keeps remote images in the sandboxed email preview (srcdoc
// iframes inherit this policy).
export const helmetOptions: FastifyHelmetOptions = {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
};
