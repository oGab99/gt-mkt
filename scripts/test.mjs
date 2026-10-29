// Executa os testes de integração em um banco PostgreSQL SEPARADO.
//
//   TEST_DATABASE_URL="postgresql://.../gtstudio_test" npm test
//
// O banco de teste recebe as migrações automaticamente. Nunca aponte
// TEST_DATABASE_URL para a base de desenvolvimento ou de produção: os testes
// criam e apagam dados.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("\n✖ Defina TEST_DATABASE_URL com um banco exclusivo para testes.\n");
  process.exit(1);
}
if (url === process.env.DATABASE_URL) {
  console.error("\n✖ TEST_DATABASE_URL não pode ser igual a DATABASE_URL.\n");
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: url,
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "test-secret-test-secret-test-secret-123",
  STORAGE_DIR: mkdtempSync(path.join(tmpdir(), "gt-test-storage-")),
  // Sem provedor de e-mail nos testes: nada é enviado.
  SMTP_HOST: "",
  RESEND_API_KEY: "",
  MAIL_PROVIDER: "",
};

const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "inherit" });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const files = process.argv.slice(2);
const run = spawnSync(
  process.execPath,
  ["--import", "./tests/setup.mjs", "--import", "tsx", "--test", "--test-concurrency=1", ...(files.length ? files : ["tests/**/*.test.ts"])],
  { env, stdio: "inherit" },
);
process.exit(run.status ?? 1);
