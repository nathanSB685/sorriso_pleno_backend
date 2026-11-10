create extension if not exists btree_gist;

-- Profissionais e salas (Módulo 2)
create table dentistas (
  id serial primary key,
  nome text not null,
  cro text not null unique,
  telefone text,
  email text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create table especialidades (id serial primary key, nome text not null unique);
create table dentista_especialidades (
  dentista_id int not null references dentistas(id) on delete cascade,
  especialidade_id int not null references especialidades(id),
  primary key (dentista_id, especialidade_id)
);
create table turnos_dentista (
  id serial primary key,
  dentista_id int not null references dentistas(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  inicio time not null,
  fim time not null,
  check (inicio < fim)
);
create table salas (
  id serial primary key,
  nome text not null unique,
  ativa boolean not null default true
);
create table procedimentos (
  id serial primary key,
  nome text not null unique,
  duracao_min int not null check (duracao_min > 0),
  valor numeric(10,2)
);

-- Acesso
create table usuarios (
  id serial primary key,
  nome text not null,
  email text not null unique,
  senha_hash text not null,
  perfil text not null check (perfil in ('recepcao', 'dentista', 'admin')),
  dentista_id int references dentistas(id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Pacientes (Módulo 1)
create table pacientes (
  id serial primary key,
  nome text not null,
  cpf char(11) not null unique check (cpf ~ '^[0-9]{11}$'),
  data_nascimento date not null,
  whatsapp text,
  observacoes text,
  tipo_atendimento text not null default 'Particular' check (tipo_atendimento in ('Particular', 'Convênio')),
  convenio_nome text,
  convenio_carteirinha text,
  convenio_validade date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (tipo_atendimento = 'Particular'
         or (convenio_nome is not null and convenio_carteirinha is not null and convenio_validade is not null))
);
create table anamneses (
  paciente_id int primary key references pacientes(id) on delete cascade,
  queixa_principal text,
  historico_medico text,
  medicamentos text,
  cirurgias text,
  alergias text,
  hipertensao boolean not null default false,
  condicoes_especiais text,
  preferencias text,
  atualizado_em timestamptz not null default now()
);
create table anamnese_historico (
  id serial primary key,
  paciente_id int not null references pacientes(id) on delete cascade,
  anotacao text not null,
  usuario_id int references usuarios(id),
  criado_em timestamptz not null default now()
);

-- Agenda (Módulo 3): o banco impede choque de horário de dentista e de sala
create table consultas (
  id serial primary key,
  paciente_id int not null references pacientes(id),
  dentista_id int not null references dentistas(id),
  sala_id int not null references salas(id),
  procedimento_id int not null references procedimentos(id),
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'Agendada'
    check (status in ('Agendada', 'Confirmada', 'Em Atendimento', 'Concluída', 'Falta Injustificada', 'Cancelada')),
  origem text not null default 'Balcão' check (origem in ('Balcão', 'WhatsApp')),
  criado_em timestamptz not null default now(),
  check (inicio < fim),
  constraint sem_choque_dentista exclude using gist
    (dentista_id with =, tstzrange(inicio, fim) with &&)
    where (status not in ('Cancelada', 'Falta Injustificada')),
  constraint sem_choque_sala exclude using gist
    (sala_id with =, tstzrange(inicio, fim) with &&)
    where (status not in ('Cancelada', 'Falta Injustificada'))
);
create index on consultas (inicio);
create index on consultas (dentista_id, inicio);

create table consulta_historico (
  id serial primary key,
  consulta_id int not null references consultas(id) on delete cascade,
  acao text not null check (acao in ('criada', 'status', 'remarcada', 'cancelada')),
  status_anterior text,
  status_novo text,
  inicio_anterior timestamptz,
  inicio_novo timestamptz,
  motivo text,
  usuario_id int references usuarios(id),
  criado_em timestamptz not null default now()
);

-- Financeiro
create table pagamentos (
  id serial primary key,
  paciente_id int not null references pacientes(id),
  procedimento text not null,
  valor numeric(10,2) not null check (valor > 0),
  forma text not null check (forma in ('PIX', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro')),
  parcelas smallint not null default 1 check (parcelas >= 1),
  data_pagamento date not null, -- vencimento enquanto Pendente
  status text not null default 'Pendente' check (status in ('Pendente', 'Concluído')),
  criado_em timestamptz not null default now()
);
create index on pagamentos (paciente_id, status);
