-- Remove TUDO que supabase/sql/demo-dados.sql criou (ids 'dede00…' e telefones 159900000xx / 159910000xx).
-- Não desfaz: preços das bebidas na pizzaria e os nomes da equipe do Hairhair (eram "70,00").
delete from delivery_pedidos where id::text like 'dede00%';
delete from tenant_appointments where id::text like 'dede00%';
delete from tenant_vendas where id::text like 'dede00%';
delete from tenant_services where id::text like 'dede00%';
delete from delivery_cardapio_bordas where id::text like 'dede00%';
delete from delivery_cardapio_combos where id::text like 'dede00%';
delete from tenant_status where id::text like 'dede00%';
delete from tenant_promocoes where id::text like 'dede00%';
delete from avaliacoes where id::text like 'dede00%';
delete from tenant_acessos_diarios where id::text like 'dede00%';
delete from tenant_clients where telefone like '159900000%' or telefone like '159910000%';
delete from vb_clientes_globais where telefone like '159900000%' or telefone like '159910000%';
