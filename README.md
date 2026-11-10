# Sorriso Pleno – Backend

API REST em Node.js (Express 5) + PostgreSQL. Repositório separado do front (`sorriso-pleno`).

## Como rodar
```bash
docker compose up -d        # PostgreSQL em localhost:5432
cp .env.example .env        # ajuste JWT_SECRET e CORS_ORIGIN (origem do front)
npm install
npm run migrate             # cria as tabelas
npm run seed                # dentistas, salas, procedimentos e 2 logins de teste
npm run dev                 # http://localhost:3333
```
Logins de teste (senha `sorriso123`): `recepcao@sorrisopleno.com` e `renata.santos@sorrisopleno.com` (dentista).

## Rotas já prontas (`/api/v1`)
| Método | Rota | Perfis |
|---|---|---|
| POST | `/auth/login` | público |
| GET | `/auth/me` | autenticado |
| GET | `/pacientes?nome=&cpf=` | recepção, dentista, admin |
| GET | `/pacientes/:id` | recepção, dentista, admin |
| POST / PUT | `/pacientes`, `/pacientes/:id` | recepção, admin |
| GET | `/health` | público |

Autenticação: `Authorization: Bearer <token>`.

## Estrutura
```
src/
├── app.js, server.js
├── config/env.js            variáveis de ambiente validadas
├── db/                      pool, migrate.js, seed.js, migrations/*.sql
├── middleware/              auth (JWT + perfil), validar (zod), error
├── modules/<modulo>/        *.routes.js e *.schema.js por módulo
└── utils/                   cpf, errors
```

## Regras que o banco já garante
- CPF único e com 11 dígitos; convênio exige nome, carteirinha e validade.
- Dentista e sala não podem ter duas consultas sobrepostas (exclusion constraint); o erro vira HTTP 409.

## Próximos módulos
dentistas, salas, especialidades e turnos → procedimentos → consultas (agenda, status, histórico) → prontuário/anamnese → financeiro → WhatsApp.
