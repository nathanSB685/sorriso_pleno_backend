-- Nomes únicos sem diferenciar maiúsculas/minúsculas ("Sala 01" = "sala 01")
create unique index salas_nome_lower_idx on salas (lower(nome));
create unique index especialidades_nome_lower_idx on especialidades (lower(nome));
create unique index procedimentos_nome_lower_idx on procedimentos (lower(nome));
