# GT Studio · Sistema administrativo

Base do sistema de gestão de marketing do GT Studio. Esta primeira entrega traz
a autenticação completa: login, primeiro acesso com troca de senha obrigatória,
recuperação de senha por e-mail e uma área protegida ("Em construção").

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL ·
Prisma 7 · Better Auth (sessões no banco) · Argon2id

## Como rodar (desenvolvimento)

Pré-requisitos: Node.js 20+ e um PostgreSQL acessível.

```bash
# 1. Banco local (exemplo com Docker; qualquer PostgreSQL serve)
docker run -d --name gtstudio-db -p 5432:5432 \
  -e POSTGRES_USER=gtstudio -e POSTGRES_PASSWORD=gtstudio -e POSTGRES_DB=gtstudio \
  postgres:16

# 2. Variáveis de ambiente
cp .env.example .env
# preencha BETTER_AUTH_SECRET com: openssl rand -base64 32

# 3. Dependências, tabelas e conta administrativa
npm install
npm run setup      # = prisma migrate dev + prisma db seed

# 4. Servidor
npm run dev        # http://localhost:3000
```

## Primeiro acesso

1. Abra `http://localhost:3000/login`.
2. Entre com o usuário `gabriel` **ou** o e-mail `ogab.dev99@gmail.com` e a
   senha temporária `123456` (apenas em desenvolvimento).
3. Você será levado para **Primeiro acesso**: crie uma senha forte (12+
   caracteres, maiúscula, minúscula, número e símbolo; diferente da temporária).
4. Em seguida a aplicação abre `/em-construcao`. O botão **Sair** encerra a sessão.

Para trocar a senha depois, acesse `/primeiro-acesso` com a sessão ativa (a
senha atual será pedida). Para voltar à senha temporária no ambiente local:
`ADMIN_RESET_PASSWORD=true npm run db:seed`.

O seed é idempotente: rodar de novo não duplica a conta nem sobrescreve uma
senha já alterada.

## Arquivos de marca

| Arquivo | Caminho | Sem o arquivo |
| --- | --- | --- |
| Fundo do login | `public/images/gt-studio/login-background.webp` (servido em `/images/gt-studio/login-background.webp`) | Fundo escuro neutro com luz quente |
| Logo do card | `public/images/gt-studio/logo.png` | Texto "GT STUDIO" |

O fundo usa `background-size: cover` e `background-position: center`.

## Variáveis de ambiente

Veja `.env.example` para a lista comentada.

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | Conexão PostgreSQL |
| `APP_URL` | sim | URL pública (https em produção) |
| `BETTER_AUTH_SECRET` | sim | Segredo das sessões, 32+ caracteres |
| `TRUST_PROXY` | não | `true` atrás de proxy confiável (ativa limite por IP) |
| `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_NAME` | não | Dados do admin no seed |
| `ADMIN_INITIAL_PASSWORD` | em produção | Senha temporária forte do admin |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | para recuperação de senha | Servidor SMTP |

## Produção

```bash
npm ci
npm run db:deploy
NODE_ENV=production ADMIN_INITIAL_PASSWORD='<senha temporária forte>' npm run db:seed
npm run build && npm start
```

Em produção o seed recusa senha fraca ou ausente, `APP_URL` precisa ser https e
os cookies passam a ser `Secure` (prefixo `__Secure-`).

## Segurança implementada

- Senhas com **Argon2id** (salt aleatório embutido no hash); nada em texto puro.
- Sessões guardadas no banco; o navegador recebe só um cookie assinado
  **HttpOnly**, **SameSite=Lax** e **Secure** em produção. Nada em `localStorage`.
- Validade de 7 dias com "Lembrar de mim" (sem ele, cookie de sessão do
  navegador e 1 dia no servidor), renovada no máximo uma vez por dia.
- Nenhuma rota HTTP pública de autenticação: tudo passa por Server Actions, que
  validam a origem da requisição (proteção CSRF do Next.js) e as entradas (Zod).
- Cadastro público desativado.
- **Rate limiting** no banco: 5 falhas por conta a cada 15 min, 30 por IP
  (com `TRUST_PROXY=true`), além de limites na troca e recuperação de senha.
  As chaves são hashes, sem e-mail ou IP em texto puro.
- Mensagem de erro única ("Usuário, e-mail ou senha incorretos.") e mesmo custo
  de processamento para contas inexistentes.
- Recuperação de senha com token aleatório, guardado como hash, válido por
  30 minutos e de uso único; todas as sessões são encerradas após a redefinição.
- Rotas protegidas verificadas no servidor (proxy + checagem em cada página) e
  controle de acesso por papel (`src/lib/auth/roles.ts`).
- Cabeçalhos de segurança (X-Frame-Options, HSTS em produção, etc.).

## Estrutura

```
prisma/
  schema.prisma          modelos (user, session, account, verification, rate_limit)
  migrations/            migrações SQL
  seed.ts                conta administrativa inicial
src/
  proxy.ts               proteção e renovação de sessão nas rotas privadas
  app/
    (auth)/login             tela de login
    (auth)/primeiro-acesso   troca de senha (primeiro acesso e posteriores)
    (auth)/esqueci-senha     pedido de recuperação
    (auth)/redefinir-senha   nova senha a partir do link do e-mail
    (protected)/em-construcao  área protegida + logout
  components/            interface (moldura do login, campos, botões, ícones)
  lib/
    auth/                configuração Better Auth, sessão, papéis, senhas
    security/            rate limiting, IP do cliente
    mail/                envio SMTP e modelo do e-mail
    validation/          esquemas Zod
    env.ts, db.ts, brand.ts
```
