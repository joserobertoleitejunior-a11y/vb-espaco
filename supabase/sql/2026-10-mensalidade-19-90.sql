-- Fase de finalização: nada é cobrado (mp-criar-cobranca recusa enquanto
-- o secret COBRANCA_ATIVA não for "sim"). A mensalidade que vale quando o
-- app for finalizado passa a ser R$ 19,90 — pra quem já existe e pra quem
-- se cadastrar daqui pra frente. (Aplicado.)
alter table public.estabelecimentos alter column mensalidade set default 19.90;
update public.estabelecimentos set mensalidade = 19.90 where mensalidade is distinct from 19.90;
