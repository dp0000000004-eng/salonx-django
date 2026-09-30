import { createMiddleware } from '@tanstack/react-start';
export const requireDjangoAuth=createMiddleware().server(async ({next})=>next());
export const requireSupabaseAuth=requireDjangoAuth;
