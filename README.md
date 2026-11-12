# Sorriso Pleno – Backend

API REST do sistema de gestão do consultório odontológico Sorriso Pleno: pacientes, dentistas, salas, agenda de consultas, prontuário (anamnese e alertas clínicos) e financeiro.

- **Stack:** Node.js 22 · Express 5 · PostgreSQL 17 · JWT · Zod
- **Front-end:** repositório separado (HTML/CSS/JS, publicado na Vercel)
- **API em produção:** `https://sorriso-pleno-api.onrender.com` (verifique em `/health`)

## Sumário

1. [Rodando localmente](#rodando-localmente)
2. [Scripts](#scripts)
3. [Variáveis de ambiente](#variáveis-de-ambiente)
4. [Estrutura do projeto](#estrutura-do-projeto)
5. [Autenticação e perfis](#autenticação-e-perfis)
6. [Rotas](#rotas-apiv1)
7. [Regras de negócio](#regras-de-negócio)
8. [Formato de erros](#formato-de-erros)
9. [Testes](#testes)
10. [Deploy (Render)](#deploy-render)
11. [Pendências](#pendências)

## Rodando localmente

Requisitos: Node.js 22+, Docker e Docker Compose.

```bash
docker compose up -d        # PostgreSQL local (neste repositório publicado na porta 5433)
cp .env.example .env        # ajuste DATABASE_URL (porta), JWT_SECRET e CORS_ORIGIN
npm install
npm run migrate             # cria as tabelas
npm run seed                # dados de exemplo + 2 logins de teste (só em desenvolvimento)
npm run dev                 # http://localhost:3333
```

Se a porta 5432 já estiver ocupada por outro banco, mantenha o mapeamento `5433:5432` do `docker-compose.yml` e use `localhost:5433` no `DATABASE_URL`.

Logins de teste do `seed` (senha `sorriso123`):

| E-mail                           | Perfil                        |
| -------------------------------- | ----------------------------- |
| `recepcao@sorrisopleno.com`      | recepção                      |
| `renata.santos@sorrisopleno.com` | dentista (Dra. Renata Santos) |

O `seed` se recusa a rodar com `NODE_ENV=production`.

Verificação rápida: `curl http://localhost:3333/health` deve responder `{"status":"ok"}`.

## Scripts

| Comando                 | O que faz                                                              |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run dev`           | API com recarga automática (usa `.env`)                                |
| `npm start`             | API em produção (usa as variáveis do ambiente, sem `.env`)             |
| `npm run migrate`       | Aplica as migrations pendentes (usa `.env`)                            |
| `npm run migrate:prod`  | Igual, mas com as variáveis do ambiente (para o banco de produção)     |
| `npm run seed`          | Dados de exemplo e logins de teste (desenvolvimento)                   |
| `npm run seed-base`     | Só dados básicos: especialidades, salas e procedimentos (sem usuários) |
| `npm run criar-usuario` | Cadastra um usuário real, perguntando nome, e-mail, perfil e senha     |
| `npm test`              | Testes unitários (`node --test`)                                       |

## Variáveis de ambiente

| Variável         | Descrição                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`       | `development` ou `production`                                                                                  |
| `PORT`           | Porta da API (padrão 3333; o Render define sozinho)                                                            |
| `DATABASE_URL`   | String de conexão do PostgreSQL                                                                                |
| `JWT_SECRET`     | Segredo do token (mínimo 16 caracteres; em produção, um valor longo e aleatório)                               |
| `JWT_EXPIRES_IN` | Validade do token (padrão `8h`)                                                                                |
| `TZ_CLINICA`     | Fuso da clínica, usado para turnos e horários (padrão `America/Sao_Paulo`)                                     |
| `CORS_ORIGIN`    | Origens do front permitidas, separadas por vírgula, sem barra no final (ex.: `https://seu-projeto.vercel.app`) |

Nunca versione o `.env` (já está no `.gitignore`).

## Estrutura do projeto

```
src/
├── app.js, server.js
├── config/env.js                 variáveis de ambiente validadas
├── db/
│   ├── pool.js                   conexão e transações
│   ├── migrate.js, seed.js, seed-base.js, criar-usuario.js
│   └── migrations/               001_init, 002_unicidade, 003_pagamentos_concluido
├── middleware/                   auth (JWT + perfil), validar (zod), error
├── modules/
│   ├── auth/                     login e /me
│   ├── pacientes/                cadastro, convênio e busca
│   ├── dentistas/                dentistas, especialidades e turnos
│   ├── salas/
│   ├── catalogo/                 especialidades e procedimentos
│   ├── consultas/                agenda, status, remarcação e histórico
│   ├── prontuario/               anamnese e alertas clínicos
│   └── financeiro/               pagamentos
└── utils/                        cpf, errors, turnos, status, alertas
test/                             testes unitários
```

Cada módulo tem `*.routes.js` (rotas) e `*.schema.js` (validação); o de consultas tem também `consultas.service.js`.

## Autenticação e perfis

- `POST /api/v1/auth/login` com `{ "email", "senha" }` devolve `{ token, usuario }`.
- Demais rotas exigem o header `Authorization: Bearer <token>`.
- Perfis: **recepcao**, **dentista** e **admin** (o admin tem as permissões dos outros dois).
- O dentista só enxerga a própria agenda; a recepção não acessa dados clínicos (prontuário); o financeiro é restrito a recepção e admin.

## Rotas (`/api/v1`)

Perfis: **R** = recepção, **D** = dentista, **A** = admin.

### Auth

| Método | Rota          | Acesso      |
| ------ | ------------- | ----------- |
| POST   | `/auth/login` | público     |
| GET    | `/auth/me`    | autenticado |

### Pacientes

| Método | Rota                                   | Acesso  |
| ------ | -------------------------------------- | ------- |
| GET    | `/pacientes?nome=&cpf=&limit=&offset=` | R, D, A |
| GET    | `/pacientes/:id`                       | R, D, A |
| POST   | `/pacientes`                           | R, A    |
| PUT    | `/pacientes/:id`                       | R, A    |

A resposta inclui `cpf_mascarado`, `inadimplente` (pendência há mais de 30 dias) e `convenio_vencido`.

### Dentistas, salas e catálogo

| Método           | Rota                                                                                             | Acesso                        |
| ---------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- |
| GET              | `/dentistas?busca=&ativo=`                                                                       | R, D, A                       |
| GET              | `/dentistas/:id` (inclui turnos)                                                                 | R, D, A                       |
| POST / PUT       | `/dentistas`, `/dentistas/:id`                                                                   | R, A                          |
| PATCH            | `/dentistas/:id/status` `{ "ativo": false }`                                                     | R, A                          |
| PUT              | `/dentistas/:id/especialidades` `{ "especialidade_ids": [1, 2] }`                                | R, A                          |
| GET / PUT        | `/dentistas/:id/turnos` `{ "turnos": [{ "dia_semana": 1, "inicio": "08:00", "fim": "12:00" }] }` | leitura: todos; PUT: R, A     |
| GET              | `/salas?ativa=`                                                                                  | R, D, A                       |
| POST / PUT       | `/salas`, `/salas/:id`                                                                           | R, A                          |
| PATCH            | `/salas/:id/status` `{ "ativa": false }`                                                         | R, A                          |
| GET / POST       | `/especialidades`                                                                                | leitura: todos; POST: R, A    |
| GET / POST / PUT | `/procedimentos`                                                                                 | leitura: todos; escrita: R, A |

Dentistas e salas não são excluídos: apenas inativados.

### Consultas

| Método | Rota                                                                                           | Acesso                   |
| ------ | ---------------------------------------------------------------------------------------------- | ------------------------ |
| GET    | `/consultas/disponibilidade?dentista_id=&procedimento_id=&data=`                               | R, D, A                  |
| GET    | `/consultas?data=` ou `?de=&ate=` (filtros: `dentista_id`, `paciente_id`, `sala_id`, `status`) | R, D, A                  |
| GET    | `/consultas/:id` (com histórico)                                                               | R, D, A                  |
| POST   | `/consultas`                                                                                   | R, A                     |
| PATCH  | `/consultas/:id/status` `{ "status": "Confirmada" }`                                           | R, D (só as próprias), A |
| POST   | `/consultas/:id/cancelar` `{ "motivo" }`                                                       | R, A                     |
| POST   | `/consultas/:id/remarcar` `{ "inicio", "motivo", "dentista_id?", "sala_id?" }`                 | R, A                     |
| PATCH  | `/consultas/:id/sala` `{ "sala_id" }`                                                          | R, A                     |

O `inicio` deve vir em ISO com fuso, por exemplo `2026-11-18T09:00:00-03:00`.

### Prontuário

| Método | Rota                                                      | Acesso |
| ------ | --------------------------------------------------------- | ------ |
| GET    | `/pacientes/:id/anamnese` (anamnese, alertas e histórico) | D, A   |
| PUT    | `/pacientes/:id/anamnese`                                 | D, A   |

### Financeiro

| Método | Rota                                                     | Acesso |
| ------ | -------------------------------------------------------- | ------ |
| GET    | `/pagamentos?status=&paciente_id=&busca=&limit=&offset=` | R, A   |
| GET    | `/pagamentos/resumo`                                     | R, A   |
| GET    | `/pagamentos/:id`                                        | R, A   |
| POST   | `/pagamentos`                                            | R, A   |
| PUT    | `/pagamentos/:id` (só enquanto Pendente)                 | R, A   |
| PATCH  | `/pagamentos/:id/concluir`                               | R, A   |

O CPF completo nunca sai pela API do financeiro (somente `cpf_mascarado`).

### Saúde

`GET /health` (público) verifica a API e a conexão com o banco.

## Regras de negócio

- **Pacientes:** CPF válido e único; atendimento por convênio exige nome, carteirinha e validade.
- **Agenda:** a duração vem do procedimento; o horário precisa estar dentro do expediente do dentista e no futuro; dentista e sala não podem ter consultas sobrepostas (validado no código e garantido pelo banco com _exclusion constraint_); dentista ou sala inativos não recebem novos agendamentos.
- **Inadimplência:** paciente com pendência há mais de 30 dias não pode ter consulta marcada, e o alerta aparece na ficha.
- **Status da consulta:** Agendada → Confirmada → Em Atendimento → Concluída; Falta Injustificada e Cancelada só antes de iniciar o atendimento.
- **Histórico:** cancelar e remarcar exigem motivo (mínimo 5 caracteres); todas as alterações ficam registradas com usuário e data.
- **Turnos:** início anterior ao fim, sem sobreposição no mesmo dia; alterar turnos que deixariam consultas futuras fora do expediente é recusado.
- **Prontuário:** queixa principal e histórico médico obrigatórios; cada gravação gera registro no histórico. Alergias, hipertensão e condições especiais viram alertas de risco; preferências viram alertas de atenção. A recepção não recebe dados clínicos.
- **Financeiro:** pagamento concluído não pode ser editado.

## Formato de erros

```json
{
  "erro": "Mensagem em português",
  "campos": [{ "campo": "cpf", "mensagem": "CPF inválido" }]
}
```

| Status | Quando                                                      |
| ------ | ----------------------------------------------------------- |
| 400    | dados inválidos                                             |
| 401    | sem token, token inválido ou expirado                       |
| 403    | perfil sem permissão                                        |
| 404    | registro não encontrado                                     |
| 409    | conflito (duplicidade, choque de horário, regra de negócio) |
| 500    | erro interno                                                |

## Testes

```bash
npm test
```

Cobre as regras puras: validação e máscara de CPF, sobreposição de turnos, fluxo de status e geração de alertas. As rotas ainda são testadas manualmente (curl ou cliente HTTP); não há testes de integração com banco.

## Deploy (Render)

Arquitetura: front na Vercel → API (Web Service no Render) → PostgreSQL (Render).

1. **Banco:** crie um PostgreSQL no Render e guarde as URLs interna e externa.
2. **Migrations** (do seu computador, com a URL externa e `?sslmode=require`):
   ```bash
   DATABASE_URL="<URL externa>?sslmode=require" JWT_SECRET="texto-com-16-ou-mais-caracteres" npm run migrate:prod
   ```
3. **Dados básicos e usuários** (mesmas variáveis): `npm run seed-base` e `npm run criar-usuario`.
4. **API:** Web Service ligado a este repositório, com `npm install` como build, `npm start` como start e `/health` como health check.
5. **Variáveis no Render:** `NODE_ENV=production`, `NODE_VERSION=22`, `DATABASE_URL` (URL **interna**), `JWT_SECRET` (valor longo e aleatório) e `CORS_ORIGIN` (endereço do front).

Atenção ao escolher o plano: o serviço gratuito do Render dorme após alguns minutos sem uso e o Postgres gratuito expira. Confira os limites atuais antes de usar dados reais de pacientes; para isso, use planos pagos com backup.

## Pendências

- Integração do front com a API (em andamento, tela por tela).
- Agendamento pelo WhatsApp (história H3.004).
- Limite de tentativas no login.
- Turnos padrão ao cadastrar um dentista.
- Testes de integração das rotas.
