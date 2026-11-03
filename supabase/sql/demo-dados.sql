-- DADOS DE DEMONSTRAÇÃO — pra ver o app "cheio", como vai ficar quando estiver pronto.
-- Tudo que este arquivo cria tem id começando em 'dede00' e os clientes têm telefone
-- 159900000xx (pizzaria) ou 159910000xx (salão). Pra tirar tudo: supabase/sql/demo-limpar.sql
--
-- Negócios: Pizzaria Dom Rafa (delivery) e Hairhair (agenda).

-- =====================================================================
-- PIZZARIA DOM RAFA  (c633459d-fa57-4659-8429-812d7351cf3f)
-- =====================================================================

-- preço nos itens que estavam "a combinar" (bebidas e sabores que ficaram sem valor)
update delivery_cardapio_itens set preco = 12 where id = 'a2ad6854-33c7-4329-9ac2-6c9323e9ff0d' and preco = 0; -- Refrigerante 2L
update delivery_cardapio_itens set preco = 9  where id = '310ae919-d981-493a-b8c0-6ab3542cdaca' and preco = 0; -- Cerveja long neck
update delivery_cardapio_itens set preco = 6  where id = 'd9682eaf-fcf8-44f8-841a-8d077d018df4' and preco = 0; -- Refrigerante lata
update delivery_cardapio_itens set preco = 8  where id = 'de3e3673-59a1-4a69-b904-586d1fe0e522' and preco = 0; -- Suco natural
update delivery_cardapio_itens set preco = 4  where id = '812ef1a9-6058-458d-985a-b2a9defbbb2a' and preco = 0; -- Água
update delivery_cardapio_itens set preco = 52 where id = '39b74cfe-659e-4a63-9fc9-b30ca0cd0aec' and preco = 0; -- Camarão
update delivery_cardapio_itens set preco = 40 where id = 'ea18a155-2ac9-48d3-a443-14b421427931' and preco = 0; -- Chocolate
update delivery_cardapio_itens set preco = 40 where id = '5229ee7b-b03c-4b06-b896-221455397873' and preco = 0; -- Banana com canela

-- clientes globais (os pedidos e agendamentos apontam pra eles pelo telefone)
insert into vb_clientes_globais (telefone, nome) values
 ('15990000001','Maria Souza'),('15990000002','João Lima'),('15990000003','Ana Paula Ribeiro'),('15990000004','Carlos Mendes'),
 ('15990000005','Fernanda Alves'),('15990000006','Rafael Costa'),('15990000007','Juliana Prado'),('15990000008','Pedro Henrique'),
 ('15990000009','Camila Duarte'),('15990000010','Lucas Barros'),('15990000011','Patrícia Nunes'),('15990000012','Bruno Teixeira'),
 ('15990000013','Thiago Moura'),('15990000014','Elaine Santos'),
 ('15991000001','Larissa Gomes'),('15991000002','Renata Silva'),('15991000003','Beatriz Rocha'),('15991000004','Sandra Moreira'),
 ('15991000005','Tatiane Lopes'),('15991000006','Michele Dias'),('15991000007','Vanessa Freitas'),('15991000008','Aline Carvalho'),
 ('15991000009','Priscila Andrade'),('15991000010','Gabriela Martins'),('15991000011','Cíntia Barbosa')
on conflict (telefone) do nothing;

-- bordas
insert into delivery_cardapio_bordas (id, estabelecimento_id, nome, preco, ativo, ordem) values
 ('dede0002-0000-4000-8000-000000000001', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Catupiry', 8, true, 0),
 ('dede0002-0000-4000-8000-000000000002', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Cheddar', 8, true, 1),
 ('dede0002-0000-4000-8000-000000000003', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Chocolate', 10, true, 2)
on conflict (id) do nothing;

-- combos (promoções): o cliente escolhe os sabores entre as pizzas que têm meio a meio
insert into delivery_cardapio_combos (id, estabelecimento_id, nome, preco, itens_permitidos, qtd_sabores, ativo, ordem)
select 'dede0003-0000-4000-8000-000000000001', 'c633459d-fa57-4659-8429-812d7351cf3f', '2 pizzas grandes', 79.90,
       array_agg(id), 2, true, 0
from delivery_cardapio_itens where estabelecimento_id = 'c633459d-fa57-4659-8429-812d7351cf3f' and permite_meio_a_meio and preco > 0
on conflict (id) do nothing;
insert into delivery_cardapio_combos (id, estabelecimento_id, nome, preco, itens_permitidos, qtd_sabores, ativo, ordem)
select 'dede0003-0000-4000-8000-000000000002', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Pizza + refri 2L', 49.90,
       array_agg(id), 1, true, 1
from delivery_cardapio_itens where estabelecimento_id = 'c633459d-fa57-4659-8429-812d7351cf3f' and permite_meio_a_meio and preco > 0
on conflict (id) do nothing;

-- pedidos: 3 em andamento agora + histórico dos últimos 9 dias
with p(n, tel, nome, itens, sub, taxa, entrega, ender, status, origem, pag, troco, obs, d, hora, min_atras) as (values
 (1, '15990000001', 'Maria Souza', '[{"descricao":"Calabresa Piry","qtd":1,"preco":37.99,"total":37.99},{"descricao":"Refrigerante 2L","qtd":1,"preco":12,"total":12}]'::jsonb, 49.99, 7, 'entrega', 'Rua das Flores, 120 - Centro', 'concluido', 'site', 'pix', null::numeric, null, 9, '20:10', null::int),
 (2, '15990000002', 'João Lima', '[{"descricao":"Mussarela","qtd":2,"preco":33.99,"total":67.98}]'::jsonb, 67.98, 0, 'retirada', null, 'concluido', 'whatsapp', 'dinheiro', 100, null, 8, '19:40', null),
 (3, '15990000003', 'Ana Paula Ribeiro', '[{"descricao":"Meio a meio: Calabresa Piry / Portuguesa","qtd":1,"preco":48.99,"total":48.99,"obs":"2ª metade sem ovo. Borda Catupiry"},{"descricao":"Suco natural","qtd":1,"preco":8,"total":8}]'::jsonb, 56.99, 7, 'entrega', 'Av. Brasil, 55 - Vila Apolo', 'concluido', 'site', 'pix', null, null, 7, '21:05', null),
 (4, '15990000004', 'Carlos Mendes', '[{"descricao":"4 Queijos","qtd":1,"preco":40.99,"total":40.99},{"descricao":"Toscana","qtd":1,"preco":40.99,"total":40.99},{"descricao":"Refrigerante 2L","qtd":1,"preco":12,"total":12}]'::jsonb, 93.98, 7, 'entrega', 'Rua XV de Novembro, 880', 'concluido', 'site', 'cartao', null, 'Sem cebola em nenhuma', 6, '20:30', null),
 (5, '15990000005', 'Fernanda Alves', '[{"descricao":"Franqueijo","qtd":1,"preco":40.99,"total":40.99}]'::jsonb, 40.99, 7, 'entrega', 'Rua das Palmeiras, 14', 'cancelado', 'site', 'pix', null, 'Cliente desistiu', 5, '19:15', null),
 (6, '15990000006', 'Rafael Costa', '[{"descricao":"Brigadeiro","qtd":1,"preco":40,"total":40},{"descricao":"Confeti","qtd":1,"preco":40,"total":40}]'::jsonb, 80, 0, 'retirada', null, 'concluido', 'site', 'pix', null, null, 4, '20:50', null),
 (7, '15990000007', 'Juliana Prado', '[{"descricao":"Pepperone","qtd":1,"preco":45.99,"total":45.99},{"descricao":"Água","qtd":1,"preco":4,"total":4}]'::jsonb, 49.99, 7, 'entrega', 'Rua Sete, 301 - Jardim Aurora', 'concluido', 'site', 'pix', null, null, 3, '21:20', null),
 (8, '15990000008', 'Pedro Henrique', '[{"descricao":"Portuguesa","qtd":1,"preco":40.99,"total":40.99},{"descricao":"Bauru","qtd":1,"preco":40.99,"total":40.99},{"descricao":"Cerveja long neck","qtd":2,"preco":9,"total":18}]'::jsonb, 99.98, 7, 'entrega', 'Rua Quinze, 77', 'concluido', 'whatsapp', 'dinheiro', 120, 'Trazer troco', 3, '19:05', null),
 (9, '15990000009', 'Camila Duarte', '[{"descricao":"Marguerita","qtd":1,"preco":37.99,"total":37.99}]'::jsonb, 37.99, 0, 'retirada', null, 'concluido', 'site', 'pix', null, null, 2, '20:00', null),
 (10, '15990000010', 'Lucas Barros', '[{"descricao":"5 Queijos","qtd":1,"preco":45.99,"total":45.99},{"descricao":"Brócolis com Bacon","qtd":1,"preco":45.99,"total":45.99},{"descricao":"Refrigerante 2L","qtd":1,"preco":12,"total":12}]'::jsonb, 103.98, 7, 'entrega', 'Rua dos Ipês, 410', 'concluido', 'site', 'cartao', null, null, 1, '21:40', null),
 (11, '15990000011', 'Patrícia Nunes', '[{"descricao":"Calabresa","qtd":1,"preco":33.99,"total":33.99},{"descricao":"Frango Catupiry","qtd":1,"preco":37.99,"total":37.99}]'::jsonb, 71.98, 7, 'entrega', 'Av. Principal, 1500', 'concluido', 'site', 'pix', null, null, 1, '19:30', null),
 (12, '15990000001', 'Maria Souza', '[{"descricao":"Meio a meio: Calabresa Piry / Portuguesa","qtd":1,"preco":40.99,"total":40.99,"obs":"2ª metade sem ovo"},{"descricao":"Calabresa Cheddar","qtd":1,"preco":37.99,"total":37.99}]'::jsonb, 78.98, 7, 'entrega', 'Rua das Flores, 120 - Centro', 'novo', 'site', 'pix', null, 'Tocar o interfone', 0, '00:00', 12),
 (13, '15990000002', 'João Lima', '[{"descricao":"Alho Frito","qtd":1,"preco":37.99,"total":37.99}]'::jsonb, 37.99, 0, 'retirada', null, 'preparando', 'whatsapp', 'dinheiro', 100, null, 0, '00:00', 25),
 (14, '15990000012', 'Bruno Teixeira', '[{"descricao":"Toscana Piry","qtd":1,"preco":45.99,"total":45.99},{"descricao":"Refrigerante lata","qtd":1,"preco":6,"total":6}]'::jsonb, 51.99, 7, 'entrega', 'Rua Oito, 95 - Bela Vista', 'saiu_entrega', 'site', 'pix', null, null, 0, '00:00', 40)
)
insert into delivery_pedidos (id, estabelecimento_id, cliente_telefone, cliente_nome, itens, total, subtotal, taxa_entrega, forma_entrega, endereco_entrega,
                              status, origem, criado_em, atualizado_em, numero, forma_pagamento, troco_para, observacao)
select ('dede0001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'c633459d-fa57-4659-8429-812d7351cf3f', tel, nome, itens, sub + taxa, sub, taxa, entrega, ender,
       status, origem,
       case when min_atras is not null then now() - (min_atras || ' minutes')::interval
            else ((current_date - d) + hora::time) at time zone 'America/Sao_Paulo' end,
       case when min_atras is not null then now() - (min_atras || ' minutes')::interval
            else ((current_date - d) + hora::time + interval '40 minutes') at time zone 'America/Sao_Paulo' end,
       n, pag, troco, obs
from p
on conflict (id) do nothing;

-- vendas de balcão (aba Caixa)
insert into tenant_vendas (id, estabelecimento_id, descricao, valor, forma_pagamento, criado_em, cliente_nome)
select ('dede0004-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'c633459d-fa57-4659-8429-812d7351cf3f', descr, valor, forma,
       ((current_date - d) + hora::time) at time zone 'America/Sao_Paulo', cli
from (values
 (1, 'Mussarela', 33.99, 'dinheiro', 6, '19:20', null::text),
 (2, 'Calabresa + refri lata', 39.99, 'pix', 5, '20:05', null),
 (3, '2x Portuguesa', 81.98, 'cartao', 4, '21:10', 'Marcos'),
 (4, 'Frango Catupiry', 37.99, 'pix', 3, '19:45', null),
 (5, 'Brigadeiro', 40, 'dinheiro', 2, '20:35', null),
 (6, '4 Queijos + cerveja', 49.99, 'cartao', 2, '21:15', null),
 (7, 'Toscana', 40.99, 'pix', 1, '19:10', 'Dona Lúcia'),
 (8, 'Pepperone + suco', 53.99, 'pix', 0, '12:30', null)
) v(n, descr, valor, forma, d, hora, cli)
on conflict (id) do nothing;

-- recado do dia, promoção, avaliações e visitas ao site
insert into tenant_status (id, estabelecimento_id, texto, criado_em, expira_em) values
 ('dede0005-0000-4000-8000-000000000001', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Forno aceso! Hoje tem 4 Queijos com borda de graça.', now(), now() + interval '20 hours')
on conflict (id) do nothing;
insert into tenant_promocoes (id, estabelecimento_id, titulo, texto, criado_em, expira_em) values
 ('dede0005-0000-4000-8000-000000000002', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Terça em dobro', '2 pizzas grandes por R$ 79,90 toda terça. Escolha qualquer sabor.', now(), now() + interval '7 days')
on conflict (id) do nothing;
insert into avaliacoes (id, estabelecimento_id, cliente_nome, cliente_telefone, nota, comentario, criado_em) values
 ('dede0005-0000-4000-8000-000000000011', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Ana Paula R.', '15990000003', 5, 'Massa leve e chegou quentinha. O meio a meio é perfeito!', now() - interval '6 days'),
 ('dede0005-0000-4000-8000-000000000012', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Carlos M.', '15990000004', 5, 'Melhor 4 queijos da cidade.', now() - interval '5 days'),
 ('dede0005-0000-4000-8000-000000000013', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Lucas B.', '15990000010', 4, 'Muito boa, só demorou um pouco numa sexta.', now() - interval '1 days'),
 ('dede0005-0000-4000-8000-000000000014', 'c633459d-fa57-4659-8429-812d7351cf3f', 'Camila D.', '15990000009', 5, 'Atendimento ótimo e preço justo.', now() - interval '2 days')
on conflict (id) do nothing;
insert into tenant_acessos_diarios (id, estabelecimento_id, dia, contagem)
select ('dede0006-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'c633459d-fa57-4659-8429-812d7351cf3f', current_date - g, 28 + ((g * 17) % 41)
from generate_series(0, 13) g
on conflict do nothing;

-- =====================================================================
-- HAIRHAIR  (d71109d1-62ea-4892-bab5-6c63ca2a3301)
-- =====================================================================

-- equipe: os 3 nomes estavam salvos como "70,00" (valor digitado no campo errado)
update tenant_staff set nome = 'Carla' where id = '91866842-fb2e-441b-9a56-9f4a6a9ee9f3' and nome = '70,00';
update tenant_staff set nome = 'Bianca' where id = 'a577ef4b-07dd-43f7-98e4-8ec58e8be62f' and nome = '70,00';
update tenant_staff set nome = 'Dani' where id = '85d4e405-e316-4264-bc6e-6206e899d3f4' and nome = '70,00';

-- mais serviços
insert into tenant_services (id, estabelecimento_id, nome, preco, categoria, ativo, duracao_min) values
 ('dede0007-0000-4000-8000-000000000001', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Hidratação', 80, 'Cabelo', true, 60),
 ('dede0007-0000-4000-8000-000000000002', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Manicure', 35, 'Unhas', true, 45),
 ('dede0007-0000-4000-8000-000000000003', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Pedicure', 40, 'Unhas', true, 50),
 ('dede0007-0000-4000-8000-000000000004', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Mechas', 180, 'Cabelo', true, 150)
on conflict (id) do nothing;

-- agendamentos: 12 já concluídos, 4 hoje, 3 amanhã e 2 nos próximos dias
with a(n, tel, nome, staff, servico, d, hora, status, orig, dur) as (values
 (1, '15991000001', 'Larissa Gomes', '91866842-fb2e-441b-9a56-9f4a6a9ee9f3', 'Corte feminino', -13, '09:00', 'concluido', 'site', 60),
 (2, '15991000002', 'Renata Silva', 'a577ef4b-07dd-43f7-98e4-8ec58e8be62f', 'Coloração', -12, '10:30', 'concluido', 'site', 120),
 (3, '15991000003', 'Beatriz Rocha', '85d4e405-e316-4264-bc6e-6206e899d3f4', 'Manicure', -11, '14:00', 'concluido', 'pdv', 45),
 (4, '15991000004', 'Sandra Moreira', '91866842-fb2e-441b-9a56-9f4a6a9ee9f3', 'Escova', -10, '15:30', 'concluido', 'site', 45),
 (5, '15991000005', 'Tatiane Lopes', 'a577ef4b-07dd-43f7-98e4-8ec58e8be62f', 'Hidratação', -9, '09:30', 'concluido', 'site', 60),
 (6, '15991000001', 'Larissa Gomes', '91866842-fb2e-441b-9a56-9f4a6a9ee9f3', 'Escova', -8, '11:00', 'concluido', 'site', 45),
 (7, '15991000006', 'Michele Dias', '85d4e405-e316-4264-bc6e-6206e899d3f4', 'Pedicure', -7, '13:30', 'concluido', 'pdv', 50),
 (8, '15991000007', 'Vanessa Freitas', 'a577ef4b-07dd-43f7-98e4-8ec58e8be62f', 'Mechas', -6, '09:00', 'concluido', 'site', 150),
 (9, '15991000008', 'Aline Carvalho', '91866842-fb2e-441b-9a56-9f4a6a9ee9f3', 'Corte feminino', -4, '16:00', 'concluido', 'site', 60),
 (10, '15991000002', 'Renata Silva', 'a577ef4b-07dd-43f7-98e4-8ec58e8be62f', 'Escova', -3, '10:00', 'concluido', 'site', 45),
 (11, '15991000003', 'Beatriz Rocha', '85d4e405-e316-4264-bc6e-6206e899d3f4', 'Manicure', -2, '14:30', 'concluido', 'site', 45),
 (12, '15991000009', 'Priscila Andrade', '91866842-fb2e-441b-9a56-9f4a6a9ee9f3', 'Corte feminino', -1, '17:00', 'cancelado', 'site', 60),
 (13, '15991000004', 'Sandra Moreira', '91866842-fb2e-441b-9a56-9f4a6a9ee9f3', 'Corte feminino', 0, '09:00', 'confirmado', 'site', 60),
 (14, '15991000005', 'Tatiane Lopes', 'a577ef4b-07dd-43f7-98e4-8ec58e8be62f', 'Coloração', 0, '10:30', 'confirmado', 'site', 120),
 (15, '15991000010', 'Gabriela Martins', '85d4e405-e316-4264-bc6e-6206e899d3f4', 'Manicure', 0, '14:00', 'pendente', 'site', 45),
 (16, '15991000006', 'Michele Dias', '85d4e405-e316-4264-bc6e-6206e899d3f4', 'Pedicure', 0, '15:00', 'pendente', 'site', 50),
 (17, '15991000001', 'Larissa Gomes', '91866842-fb2e-441b-9a56-9f4a6a9ee9f3', 'Hidratação', 1, '09:30', 'confirmado', 'site', 60),
 (18, '15991000007', 'Vanessa Freitas', 'a577ef4b-07dd-43f7-98e4-8ec58e8be62f', 'Escova', 1, '11:00', 'pendente', 'site', 45),
 (19, '15991000008', 'Aline Carvalho', '91866842-fb2e-441b-9a56-9f4a6a9ee9f3', 'Escova', 1, '16:30', 'pendente', 'site', 45),
 (20, '15991000002', 'Renata Silva', 'a577ef4b-07dd-43f7-98e4-8ec58e8be62f', 'Mechas', 3, '09:00', 'confirmado', 'site', 150),
 (21, '15991000003', 'Beatriz Rocha', '85d4e405-e316-4264-bc6e-6206e899d3f4', 'Pedicure', 4, '13:00', 'pendente', 'site', 50)
)
insert into tenant_appointments (id, estabelecimento_id, cliente_nome, cliente_telefone, staff_id, staff_nome, servico, dia, dia_label, horario, status, origem, duracao_min, criado_em)
select ('dede0008-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'd71109d1-62ea-4892-bab5-6c63ca2a3301', nome, tel, staff::uuid,
       (select t.nome from tenant_staff t where t.id = staff::uuid), servico, current_date + d, to_char(current_date + d, 'DD/MM'), hora, status, orig, dur,
       now() - interval '3 days'
from a
on conflict (id) do nothing;

-- vendas do salão (as dos atendimentos concluídos + alguns produtos)
insert into tenant_vendas (id, estabelecimento_id, servico_id, staff_id, staff_nome, descricao, valor, forma_pagamento, criado_em, cliente_nome, cliente_telefone)
select ('dede0009-0000-4000-8000-' || lpad(a.n::text, 12, '0'))::uuid, 'd71109d1-62ea-4892-bab5-6c63ca2a3301',
       (select s.id from tenant_services s where s.estabelecimento_id = 'd71109d1-62ea-4892-bab5-6c63ca2a3301' and s.nome = a.servico limit 1),
       a.staff_id, a.staff_nome, a.servico,
       coalesce((select s.preco from tenant_services s where s.estabelecimento_id = 'd71109d1-62ea-4892-bab5-6c63ca2a3301' and s.nome = a.servico limit 1), 50),
       (array['pix', 'cartao', 'dinheiro', 'pix'])[1 + (right(a.id::text, 2)::int % 4)],
       (a.dia + a.horario::time + (a.duracao_min || ' minutes')::interval) at time zone 'America/Sao_Paulo', a.cliente_nome, a.cliente_telefone
from tenant_appointments a
where a.id::text like 'dede0008%' and a.status = 'concluido'
on conflict (id) do nothing;
insert into tenant_vendas (id, estabelecimento_id, descricao, valor, forma_pagamento, criado_em, cliente_nome) values
 ('dede0009-0000-4000-8000-000000000101', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Shampoo profissional', 62, 'pix', now() - interval '5 days', 'Sandra Moreira'),
 ('dede0009-0000-4000-8000-000000000102', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Máscara de hidratação', 48, 'cartao', now() - interval '3 days', null),
 ('dede0009-0000-4000-8000-000000000103', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Esmalte + base', 28, 'dinheiro', now() - interval '1 days', 'Beatriz Rocha')
on conflict (id) do nothing;

-- recado, promoção, avaliações e visitas
insert into tenant_status (id, estabelecimento_id, texto, criado_em, expira_em) values
 ('dede0005-0000-4000-8000-000000000101', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Hoje temos horários livres à tarde. Agende pelo site!', now(), now() + interval '20 hours')
on conflict (id) do nothing;
insert into tenant_promocoes (id, estabelecimento_id, titulo, texto, criado_em, expira_em) values
 ('dede0005-0000-4000-8000-000000000102', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Escova + hidratação', 'Combo por R$ 110 de segunda a quarta.', now(), now() + interval '10 days')
on conflict (id) do nothing;
insert into avaliacoes (id, estabelecimento_id, cliente_nome, cliente_telefone, nota, comentario, criado_em) values
 ('dede0005-0000-4000-8000-000000000111', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Larissa G.', '15991000001', 5, 'A Carla é maravilhosa, saí com o cabelo dos sonhos.', now() - interval '8 days'),
 ('dede0005-0000-4000-8000-000000000112', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Renata S.', '15991000002', 5, 'Coloração perfeita e ambiente muito agradável.', now() - interval '3 days'),
 ('dede0005-0000-4000-8000-000000000113', 'd71109d1-62ea-4892-bab5-6c63ca2a3301', 'Beatriz R.', '15991000003', 4, 'Ótimo atendimento, as unhas duraram bastante.', now() - interval '2 days')
on conflict (id) do nothing;
insert into tenant_acessos_diarios (id, estabelecimento_id, dia, contagem)
select ('dede0006-0000-4000-8000-' || lpad((100 + g)::text, 12, '0'))::uuid, 'd71109d1-62ea-4892-bab5-6c63ca2a3301', current_date - g, 15 + ((g * 11) % 33)
from generate_series(0, 13) g
on conflict do nothing;

-- =====================================================================
-- CLIENTES (aba Clientes): quem pediu, quem agendou e quem só visitou o site
-- (se os gatilhos já criaram a linha, só acertamos os números)
-- =====================================================================
insert into tenant_clients (estabelecimento_id, telefone, nome, primeira_visita, ultima_visita, total_visitas, acessos)
select e, t, n, now() - interval '12 days', now() - interval '1 day', 1, 3
from (values
 ('c633459d-fa57-4659-8429-812d7351cf3f'::uuid, '15990000013', 'Thiago Moura'),
 ('c633459d-fa57-4659-8429-812d7351cf3f'::uuid, '15990000014', 'Elaine Santos'),
 ('d71109d1-62ea-4892-bab5-6c63ca2a3301'::uuid, '15991000011', 'Cíntia Barbosa')
) v(e, t, n)
on conflict do nothing;
insert into tenant_clients (estabelecimento_id, telefone, nome, primeira_visita, ultima_visita, total_visitas, acessos)
select distinct on (p.estabelecimento_id, p.cliente_telefone) p.estabelecimento_id, p.cliente_telefone, p.cliente_nome, p.criado_em, p.criado_em, 1, 1
from delivery_pedidos p where p.id::text like 'dede0001%'
on conflict do nothing;
insert into tenant_clients (estabelecimento_id, telefone, nome, primeira_visita, ultima_visita, total_visitas, acessos)
select distinct on (a.estabelecimento_id, a.cliente_telefone) a.estabelecimento_id, a.cliente_telefone, a.cliente_nome, a.criado_em, a.criado_em, 1, 1
from tenant_appointments a where a.id::text like 'dede0008%'
on conflict do nothing;

-- números certos por cliente, calculados dos pedidos e agendamentos de demonstração
update tenant_clients c set
  pedidos = (select count(*) from delivery_pedidos p where p.estabelecimento_id = c.estabelecimento_id and p.cliente_telefone = c.telefone and p.status <> 'cancelado'),
  agendamentos = (select count(*) from tenant_appointments a where a.estabelecimento_id = c.estabelecimento_id and a.cliente_telefone = c.telefone and a.status <> 'cancelado'),
  ultimo_pedido = (select max(p.criado_em) from delivery_pedidos p where p.estabelecimento_id = c.estabelecimento_id and p.cliente_telefone = c.telefone),
  ultimo_agendamento = (select max(a.criado_em) from tenant_appointments a where a.estabelecimento_id = c.estabelecimento_id and a.cliente_telefone = c.telefone),
  acessos = greatest(coalesce(c.acessos, 0), 2 + (right(c.telefone, 2)::int % 6))
where c.telefone like '159900000%' or c.telefone like '159910000%';
update tenant_clients set total_visitas = greatest(coalesce(pedidos, 0) + coalesce(agendamentos, 0), 1)
where telefone like '159900000%' or telefone like '159910000%';
