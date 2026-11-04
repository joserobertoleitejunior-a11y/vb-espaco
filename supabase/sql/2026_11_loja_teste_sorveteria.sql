-- Loja de teste: apaga a Pizzaria Dom Rafa e cria a Sorveteria Polo Norte (açaí),
-- com TUDO preenchido menos o endereço e o cardápio — que é o que vamos testar.
-- Rode tudo de uma vez no SQL Editor do Supabase.

begin;

-- 1) fora a pizzaria de teste (cardápio, pedidos, clientes e vendas saem junto, por cascade)
delete from delivery_estabelecimentos where id = 'c633459d-fa57-4659-8429-812d7351cf3f';
delete from estabelecimentos          where id = 'c633459d-fa57-4659-8429-812d7351cf3f';

-- 2) a sorveteria
insert into estabelecimentos (
  id, dono_user_id, nome, slug, cidade, segmento, areas, ativo, onboarding_concluido,
  telefone_whatsapp, template, cor_destaque, cor_secundaria, genero_atendimento,
  titulo_hero, subtitulo_hero, sobre_texto, titulo_institucional, texto_cta,
  foto_hero_url, foto_perfil_url, foto_capa_url, instagram_url, moldura_foto,
  titulo_efeito, respostas, nome_assistente, mostrar_contador_publico, seguir_cor_imagem
) values (
  '7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931',
  '32ac117a-e4f7-48e8-8d1e-3d8fdcc686a4',
  'Sorveteria Polo Norte', 'sorveteria-polo-norte', 'itapetininga', 'sorveteria',
  array['delivery'], true, true,
  '15998123456', 'escuro-premium', '#7B4BC9', '#36B9A6', 'ambos',
  'Sorveteria Polo Norte',
  'Açaí na tigela batido na hora e sorvete de massa artesanal. Escolha os acompanhamentos do seu jeito.',
  'A gente bate o açaí na hora, sem xarope pronto, e faz o sorvete de massa aqui mesmo, em pequenas levas. Tem opção zero açúcar e sem lactose pra ninguém ficar de fora.',
  'Açaí e sorvete artesanal', 'Fazer pedido',
  '/assets/estoque/acaiteria/acai-tigela.jpg',
  '/assets/estoque/sorveteria/sorvete-casquinha.jpg',
  '/assets/estoque/acaiteria/acai-frutas.jpg',
  'https://instagram.com/sorveteriapolonorte', 'simples',
  '{"alvo":"ambos","foco":"50 50","estilo":"contorno","movimento":"rolar-h"}'::jsonb,
  '{"sem_acucar":"sim","embalagem":["termica","sustentavel"]}'::jsonb,
  'Gelo', false, false
);

insert into delivery_estabelecimentos (
  id, dono_user_id, nome, slug, cidade, segmento, telefone_whatsapp, template,
  cor_destaque, ativo, onboarding_concluido, taxa_entrega, tempo_entrega_min, tempo_entrega_max,
  pedido_minimo, aceita_retirada, aceita_entrega, foto_capa_url, foto_perfil_url,
  descricao, aviso, instagram_url, status_manual, horarios, formas_pagamento, chave_pix, layout, modo
) values (
  '7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931',
  '32ac117a-e4f7-48e8-8d1e-3d8fdcc686a4',
  'Sorveteria Polo Norte', 'sorveteria-polo-norte', 'itapetininga', 'sorveteria',
  '15998123456', 'escuro-premium', '#7B4BC9', true, true,
  6.00, 25, 45, 15.00, true, true,
  '/assets/estoque/acaiteria/acai-frutas.jpg',
  '/assets/estoque/sorveteria/sorvete-casquinha.jpg',
  'Açaí batido na hora e sorvete de massa artesanal. Tem zero açúcar e sem lactose.',
  'Entrega em bolsa térmica: o açaí chega firme.',
  'https://instagram.com/sorveteriapolonorte', 'auto',
  '{"0":{"abre":"13:00","fecha":"22:00"},"1":{"fechado":true},"2":{"abre":"14:00","fecha":"22:00"},"3":{"abre":"14:00","fecha":"22:00"},"4":{"abre":"14:00","fecha":"22:00"},"5":{"abre":"14:00","fecha":"23:00"},"6":{"abre":"13:00","fecha":"23:00"}}'::jsonb,
  array['pix','cartao','dinheiro'], '15998123456', 'lista', 'cardapio'
);

insert into tenant_business_hours (estabelecimento_id, dia_semana, abre, fecha, fechado) values
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', 0, '13:00', '22:00', false),
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', 1, '14:00', '22:00', true),
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', 2, '14:00', '22:00', false),
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', 3, '14:00', '22:00', false),
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', 4, '14:00', '22:00', false),
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', 5, '14:00', '23:00', false),
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', 6, '13:00', '23:00', false);

insert into tenant_gallery (estabelecimento_id, foto_url) values
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', '/assets/estoque/acaiteria/acai-tigela.jpg'),
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', '/assets/estoque/acaiteria/acai-copo.jpg'),
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', '/assets/estoque/sorveteria/sorvete-bolas.jpg'),
  ('7f3a5c20-9b14-4e6d-8a52-1c6de0f4b931', '/assets/estoque/sorveteria/sorvete-taca.jpg');

commit;
