-- Registra quando o pagamento foi marcado como concluído
alter table pagamentos add column concluido_em timestamptz;
update pagamentos set concluido_em = criado_em where status = 'Concluído';
