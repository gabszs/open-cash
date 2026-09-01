import { createAuth } from "./auth";

// Este entrypoint é carregado apenas pelo Better Auth CLI em Node.js.
// O Worker importa `auth.ts` sem construir o plugin no escopo global.
export const auth = createAuth();
