# GT Studio · Sistema de gestão de marketing

Sistema administrativo do GT Studio: Dashboard, Postagens, Demandas, Calendário,
Financeiro, Relatórios, Empresas e Configurações (equipe, papéis e permissões,
integrações), sobre a autenticação segura já existente.

**Stack:** Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS 4 ·
PostgreSQL · Prisma 7 · Better Auth (sessões no banco) · Argon2id · Recharts ·
dnd-kit · date-fns (fuso America/Sao_Paulo)

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

# 3. Dependências, tabelas, agência, papéis e conta administrativa
npm install
npm run setup      # = prisma migrate deploy + prisma generate + prisma db seed

# 4. Servidor
npm run dev        # http://localhost:3000
```

Atualizando um ambiente existente (sem apagar dados):

```bash
git pull
npm install
npm run db:deploy  # aplica só as migrações novas + prisma generate
npm run db:seed    # idempotente: garante agência, papéis padrão e vínculo do admin
```

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run setup` | Migrações + cliente Prisma + seed (primeira instalação) |
| `npm run db:deploy` | Aplica migrações pendentes e gera o cliente |
| `npm run db:migrate` | Cria uma nova migração (desenvolvimento) e gera o cliente |
| `npm run db:seed` | Seed idempotente da conta administrativa, agência e papéis |
| `npm test` | Testes de integração do Portal do Cliente (exige `TEST_DATABASE_URL`) |

## Primeiro acesso

1. Abra `http://localhost:3000/login`.
2. Entre com o usuário `gabriel` **ou** o e-mail `ogab.dev99@gmail.com` e a
   senha temporária `123456` (apenas em desenvolvimento; em produção vem de
   `ADMIN_INITIAL_PASSWORD`).
3. Crie uma senha forte (12+ caracteres, maiúscula, minúscula, número e símbolo).
4. Você entra no **Dashboard** (`/dashboard`). A rota antiga `/em-construcao`
   redireciona para lá.

O seed não sobrescreve senha já alterada. Para voltar à senha temporária no
ambiente local: `ADMIN_RESET_PASSWORD=true npm run db:seed`.

## Módulos

| Módulo | Rota | Destaques |
| --- | --- | --- |
| Dashboard | `/dashboard` | Indicadores do mês, metas por empresa, gráfico comparado ao período anterior, fluxo de produção, agenda e resumo financeiro |
| Postagens | `/postagens` | Lista, quadro e calendário; aprovação com histórico; distribuição por rede; agendamento interno; registro manual de publicação |
| Demandas | `/demandas` | Empresa → pasta → demanda → subtarefas; visão geral, lista, quadro com arrastar e soltar, calendário e painel de detalhes |
| Calendário | `/calendario` | Dia, semana, mês e ano; prazos e postagens entram automaticamente (sem duplicar); eventos manuais por categoria |
| Financeiro | `/financeiro` | Receitas e despesas, recorrências sem duplicidade, comissões, previsto x realizado, fluxo de caixa, meta de receita |
| Relatórios | `/relatorios` | Produção mensal, publicações por empresa e metas, demandas concluídas e atrasadas, desempenho operacional, resultado financeiro |
| Empresas | `/empresas` | Cadastro, logo, contato, responsável, plataformas, situação contratual e metas mensais independentes |
| Configurações | `/configuracoes` | Perfil, Administração, Acesso (sessões), Equipe, Papéis e permissões, Integrações |

Regras de cálculo centralizadas em `src/lib/domain/`:

- Uma postagem publicada em várias redes conta **uma** entrega, na data da
  primeira publicação.
- A meta vigente de um mês é a última meta cadastrada com mês ≤ ao consultado.
- Financeiro em regime de caixa: saldo = saldo inicial + recebido − pago.
  Valores em centavos (inteiros).
- Datas gravadas em UTC e exibidas em America/Sao_Paulo.
- Métricas de alcance, visualizações e engajamento **não** são estimadas: só
  aparecerão com integrações reais.

## Equipe, papéis e permissões

- Papéis padrão criados pelo seed: **Dono da Agência** (acesso integral,
  não editável), Social Media, Filmmaker e Designer. Papéis personalizados podem
  ser criados em Configurações › Papéis e permissões.
- Permissões por módulo × ação (Visualizar, Criar, Editar, Excluir, Aprovar,
  Gerenciar), verificadas no servidor em cada página e Server Action.
- Quem não é Dono só concede permissões que possui, não altera o próprio papel
  e não altera um Dono. Sempre resta ao menos um Dono ativo.
- Acesso por empresa: "todas as empresas" ou uma lista. Os IDs vindos do
  navegador são sempre revalidados no servidor.
- Novo membro recebe uma senha temporária gerada no servidor, exibida uma
  única vez para quem cadastrou; no banco fica só o hash. A troca é obrigatória
  no primeiro acesso. Desativar um membro encerra as sessões dele.

## Integrações (arquitetura)

Instagram, Facebook, TikTok e YouTube aparecem como **Não configurada / Em
breve**. Nada é marcado como conectado sem credencial real, e nenhuma
publicação é simulada.

- A conexão usará somente APIs oficiais com OAuth (Instagram Graph API e
  Facebook Pages API via app da Meta, TikTok Content Posting API, YouTube Data
  API v3). Nunca são pedidas ou guardadas senhas de redes sociais, e não há
  automação de navegador nem scraping.
- Tabelas prontas: `integration` (status por plataforma) e
  `integration_credential` (tokens cifrados com AES-256-GCM usando
  `INTEGRATION_ENCRYPTION_KEY`).
- Cada postagem tem um alvo por rede (`post_target`) com status próprio. Hoje o
  fluxo é agendamento interno + registro manual da publicação; quando uma conta
  for conectada, o publicador preencherá `externalId`/`publishedAt` do alvo.

## Portal do Cliente

Módulo dentro do mesmo app (rotas `/portal/*`), sem duplicar empresas,
postagens, demandas ou arquivos.

- **Na equipe:** em Empresas › empresa, os botões *Visualizar como cliente*
  (prévia somente leitura, sem aprovar nem comentar) e *Compartilhar
  progresso* (convite de um representante). A aba *Portal do cliente* controla
  representantes, quem pode aprovar, etapas visíveis, revogação de convites e
  sessões. Na postagem, o painel *Aprovação do cliente* define visibilidade,
  itens obrigatórios (vídeo, legenda, capa) e envia versões. Na demanda,
  *Visível para o cliente* e os pedidos de alteração vinculados.
- **Acesso do cliente:** link individual, de uso único, que expira (convite
  72 h, link de acesso 30 min). Abrir o link não o consome; só o botão
  *Entrar no portal*. A sessão fica em cookie HttpOnly próprio (`gt_portal`),
  separado da autenticação da equipe, com expiração por inatividade (14 dias)
  e limite absoluto (30 dias). Não há link público permanente.
- **Aprovação:** cada item tem versões numeradas; a decisão fica presa à
  versão exata. Uma nova versão volta somente aquele item para aprovação. O
  agendamento/publicação revalida no servidor se todos os itens obrigatórios
  estão aprovados na versão atual. Aprovar nunca publica sozinho.
- **Isolamento:** toda consulta do portal filtra por agência + empresa do
  representante e só enxerga conteúdo liberado. Arquivos passam por
  `/portal/arquivos/[id]` (aceita `Range`, necessário no iOS), que só entrega o
  logo da empresa e arquivos de versões visíveis.
- **Notificações:** internas (sino do topo) e por e-mail via
  `src/lib/notifications` (SMTP ou Resend). Sem provedor configurado nada é
  enviado: o convite mostra o link uma única vez para a equipe repassar. Os
  e-mails não trazem link de autenticação reaproveitável, apenas o convite de
  uso único ou o endereço do portal.
- **Permissões novas** (Configurações › Papéis, bloco *Portal do Cliente*):
  ver, gerenciar acessos, compartilhar conteúdo, pré-visualizar, enviar para
  aprovação e gerenciar revisões. O Dono tem todas. Papéis já existentes não
  ganham essas permissões automaticamente.
- **Lembretes:** `sendPendingApprovalReminders(agencyId)` está pronta para ser
  chamada por um agendador (cron) quando houver um.

### Testes

```bash
createdb gtstudio_test   # banco separado
echo 'TEST_DATABASE_URL="postgresql://.../gtstudio_test"' >> .env
npm test
```

O script aplica as migrações no banco de teste, usa uma pasta de arquivos
temporária e desliga o envio de e-mail.

## Arquivos enviados

Logos, fotos de perfil, anexos de demandas e mídias de postagens ficam em
`STORAGE_DIR` (padrão `./storage`, fora de `public/` e do Git). O tipo é
validado pelo conteúdo do arquivo (assinatura), com limite de 5 MB para imagens
e 50 MB para anexos. A entrega passa por `/api/arquivos/[id]`, que confere
sessão, agência, módulo e empresa. Em produção, use um volume persistente.

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
| `AGENCY_NAME` | não | Nome da agência criada no seed (padrão "GT Studio") |
| `STORAGE_DIR` | não | Pasta privada dos uploads (padrão `./storage`) |
| `INTEGRATION_ENCRYPTION_KEY` | para integrações | Chave base64 de 32 bytes para cifrar tokens OAuth |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | para recuperação de senha | Servidor SMTP |
| `MAIL_PROVIDER` | não | `smtp` (padrão) ou `resend` |
| `RESEND_API_KEY` | se `MAIL_PROVIDER=resend` | Chave da API do Resend (usa `MAIL_FROM` como remetente) |
| `TEST_DATABASE_URL` | para `npm test` | Banco **separado** usado pelos testes (é migrado e limpo) |

## Produção

```bash
npm ci
npm run db:deploy
NODE_ENV=production ADMIN_INITIAL_PASSWORD='<senha temporária forte>' npm run db:seed
npm run build && npm start
```

Em produção o seed recusa senha fraca ou ausente, `APP_URL` precisa ser https
(o build também verifica) e os cookies passam a ser `Secure`. Não rode seeds de
demonstração na base de produção.

## Segurança implementada

- Senhas com **Argon2id** (salt aleatório embutido no hash); nada em texto puro
  no código, no banco ou nos logs (os argumentos das Server Actions não são
  registrados no log de desenvolvimento).
- Sessões no banco; o navegador recebe só um cookie assinado **HttpOnly**,
  **SameSite=Lax** e **Secure** em produção. Nada em `localStorage`.
- Nenhuma rota HTTP pública de autenticação: tudo passa por Server Actions, com
  checagem de origem (CSRF) e validação Zod.
- **Rate limiting** no login, troca e recuperação de senha.
- Mensagens de erro genéricas no login.
- RBAC verificado no servidor; isolamento por agência e por empresa em todas as
  consultas e operações.
- Uploads validados por assinatura, armazenados fora de `public/` e servidos com
  `nosniff` e CSP restritiva.
- Usuário vê e encerra as próprias sessões; troca de senha encerra as demais.

## Estrutura

```
prisma/
  schema.prisma          modelos (auth, agência, papéis, empresas, demandas,
                         postagens, calendário, financeiro, integrações, arquivos)
  migrations/            migrações SQL
  seed.ts                admin, agência e papéis padrão (idempotente)
src/
  proxy.ts               proteção e renovação de sessão nas rotas privadas
  app/
    (auth)/              login, primeiro acesso, recuperação de senha
    (app)/               dashboard, postagens, demandas, calendario, financeiro,
                         relatorios, empresas, configuracoes (+ Server Actions)
    api/arquivos/[id]    entrega autenticada de arquivos
  components/app/        shell (menu, cabeçalho), UI kit e componentes por módulo
  lib/
    auth/                Better Auth, sessão, contexto/RBAC, senhas
    domain/              regras de negócio e consultas por módulo
    permissions/         catálogo de módulos × ações e papéis padrão
    security/            rate limiting, IP do cliente
    storage.ts, tz.ts, money.ts, env.ts, db.ts
```
