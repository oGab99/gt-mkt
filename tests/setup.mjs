// Fora do Next.js, "server-only" lançaria erro ao ser importado. Nos testes
// ele é resolvido para um módulo vazio (o código testado é o mesmo do app).
import { registerHooks } from "node:module";

const empty = new URL("./server-only-stub.cjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: empty, shortCircuit: true, format: "commonjs" };
    return next(specifier, context);
  },
});
