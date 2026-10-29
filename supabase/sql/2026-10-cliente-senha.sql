-- Conta do cliente: WhatsApp + senha de 6 dígitos.
--
-- Antes, "Meus agendamentos", cancelar, remarcar e trocar serviço só
-- pediam o número de telefone: quem soubesse o WhatsApp de alguém via e
-- mexia nos horários dessa pessoa. Agora tudo isso pede uma sessão
-- (token) que só sai com a senha, com o código de redefinição ou com o
-- rosto/digital do aparelho (passkey, edge function cliente-passkey).
--
-- Sem apagar nada: as funções antigas têm o corpo trocado (mesma assinatura) e
-- passam a recusar; as novas terminam em _seguro / recebem p_token.

create extension if not exists pgcrypto with schema extensions;

alter table public.vb_clientes_globais add column if not exists pin_hash text;
alter table public.vb_clientes_globais add column if not exists pin_erros int not null default 0;
alter table public.vb_clientes_globais add column if not exists bloqueado_ate timestamptz;

create table if not exists public.vb_cliente_sessoes (
  token_hash text primary key,
  telefone text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);
create index if not exists vb_cliente_sessoes_tel on public.vb_cliente_sessoes (telefone);
alter table public.vb_cliente_sessoes enable row level security;

-- código de 6 dígitos pra criar senha nova (gerado pelo estabelecimento,
-- que manda pro WhatsApp do cliente — prova que o número é dele)
create table if not exists public.vb_cliente_codigos (
  telefone text primary key,
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas int not null default 0,
  gerado_por uuid
);
alter table public.vb_cliente_codigos enable row level security;

-- rosto/digital (passkey): a chave pública do aparelho
create table if not exists public.vb_cliente_passkeys (
  id text primary key,                 -- credential id (base64url)
  telefone text not null,
  chave_spki text not null,            -- chave pública (base64, SPKI)
  alg int not null,                    -- -7 (ES256) ou -257 (RS256)
  rp_id text not null,
  contador bigint not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists vb_cliente_passkeys_tel on public.vb_cliente_passkeys (telefone);
alter table public.vb_cliente_passkeys enable row level security;

create table if not exists public.vb_cliente_desafios (
  id uuid primary key default gen_random_uuid(),
  telefone text,
  desafio text not null,
  tipo text not null,                  -- 'registro' | 'entrar'
  expira_em timestamptz not null
);
alter table public.vb_cliente_desafios enable row level security;

-- ---------- ajudantes (não expostos) ----------
create or replace function public.vb_tel(p text) returns text
language sql immutable set search_path to 'public' as $$
  select regexp_replace(coalesce(p, ''), '\D', '', 'g');
$$;

create or replace function public.vb_hash_token(p text) returns text
language sql immutable set search_path to 'public', 'extensions' as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex');
$$;

-- cria a sessão (60 dias) e devolve o token puro (só o cliente guarda)
create or replace function public.vb_cliente_nova_sessao(p_telefone text) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.vb_cliente_sessoes (token_hash, telefone, expira_em)
  values (public.vb_hash_token(v_token), p_telefone, now() + interval '60 days');
  return v_token;
end;
$$;

-- telefone dono do token (ou erro)
create or replace function public.vb_cliente_do_token(p_token text) returns text
language plpgsql stable security definer set search_path to 'public' as $$
declare v_tel text;
begin
  select telefone into v_tel from public.vb_cliente_sessoes
  where token_hash = public.vb_hash_token(p_token) and expira_em > now();
  if v_tel is null then raise exception 'Entre de novo com sua senha.' using errcode = '28000'; end if;
  return v_tel;
end;
$$;

revoke all on function public.vb_cliente_nova_sessao(text) from public, anon, authenticated;
revoke all on function public.vb_cliente_do_token(text) from public, anon, authenticated;

-- ---------- conta ----------
-- só diz se existe conta e se tem senha (não devolve o nome de ninguém)
create or replace function public.cliente_status(p_telefone text) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'tem_conta', exists (select 1 from public.vb_clientes_globais where telefone = public.vb_tel(p_telefone)),
    'tem_senha', exists (select 1 from public.vb_clientes_globais where telefone = public.vb_tel(p_telefone) and pin_hash is not null),
    'tem_rosto', exists (select 1 from public.vb_cliente_passkeys where telefone = public.vb_tel(p_telefone))
  );
$$;

-- cria a conta (ou põe senha numa conta antiga, que ainda não tinha)
create or replace function public.cliente_criar_conta(p_telefone text, p_nome text, p_pin text) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_tel text := public.vb_tel(p_telefone); v_nome text := trim(coalesce(p_nome, ''));
begin
  if length(v_tel) < 10 or length(v_tel) > 11 then raise exception 'WhatsApp com DDD, por favor.'; end if;
  if length(v_nome) < 2 then raise exception 'Digite seu nome.'; end if;
  if coalesce(p_pin, '') !~ '^\d{6}$' then raise exception 'A senha tem 6 números.'; end if;
  if p_pin ~ '^(\d)\1{5}$' or p_pin in ('123456', '654321', '012345') then raise exception 'Essa senha é fácil demais — escolha outra.'; end if;
  if exists (select 1 from public.vb_clientes_globais where telefone = v_tel and pin_hash is not null) then
    raise exception 'Esse WhatsApp já tem senha. Entre com ela ou toque em "Esqueci a senha".';
  end if;
  insert into public.vb_clientes_globais (telefone, nome, pin_hash, atualizado_em)
  values (v_tel, v_nome, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), now())
  on conflict (telefone) do update set nome = excluded.nome, pin_hash = excluded.pin_hash, pin_erros = 0, bloqueado_ate = null, atualizado_em = now();
  return jsonb_build_object('telefone', v_tel, 'nome', v_nome, 'token', public.vb_cliente_nova_sessao(v_tel));
end;
$$;

-- entrar: 5 senhas erradas seguidas travam 15 minutos
create or replace function public.cliente_entrar(p_telefone text, p_pin text) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_tel text := public.vb_tel(p_telefone); v public.vb_clientes_globais;
begin
  select * into v from public.vb_clientes_globais where telefone = v_tel;
  if v.telefone is null or v.pin_hash is null then raise exception 'Esse WhatsApp ainda não tem senha. Crie a sua.'; end if;
  if v.bloqueado_ate is not null and v.bloqueado_ate > now() then
    raise exception 'Muitas tentativas. Espere % minutos ou redefina a senha.', ceil(extract(epoch from (v.bloqueado_ate - now())) / 60);
  end if;
  if extensions.crypt(coalesce(p_pin, ''), v.pin_hash) <> v.pin_hash then
    update public.vb_clientes_globais set pin_erros = pin_erros + 1,
      bloqueado_ate = case when pin_erros + 1 >= 5 then now() + interval '15 minutes' else null end
    where telefone = v_tel;
    raise exception 'Senha errada.%', case when v.pin_erros + 1 >= 5 then ' Travado por 15 minutos.' else '' end;
  end if;
  update public.vb_clientes_globais set pin_erros = 0, bloqueado_ate = null where telefone = v_tel;
  return jsonb_build_object('telefone', v_tel, 'nome', v.nome, 'token', public.vb_cliente_nova_sessao(v_tel));
end;
$$;

create or replace function public.cliente_sessao(p_token text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_tel text; v_nome text;
begin
  select s.telefone, c.nome into v_tel, v_nome from public.vb_cliente_sessoes s
  join public.vb_clientes_globais c on c.telefone = s.telefone
  where s.token_hash = public.vb_hash_token(p_token) and s.expira_em > now();
  if v_tel is null then return null; end if;
  return jsonb_build_object('telefone', v_tel, 'nome', v_nome);
end;
$$;

create or replace function public.cliente_sair(p_token text) returns boolean
language sql security definer set search_path to 'public' as $$
  update public.vb_cliente_sessoes set expira_em = now() where token_hash = public.vb_hash_token(p_token) returning true;
$$;

create or replace function public.cliente_trocar_senha(p_token text, p_pin text) returns boolean
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_tel text := public.vb_cliente_do_token(p_token);
begin
  if coalesce(p_pin, '') !~ '^\d{6}$' then raise exception 'A senha tem 6 números.'; end if;
  if p_pin ~ '^(\d)\1{5}$' or p_pin in ('123456', '654321', '012345') then raise exception 'Essa senha é fácil demais — escolha outra.'; end if;
  update public.vb_clientes_globais set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), pin_erros = 0, bloqueado_ate = null where telefone = v_tel;
  return true;
end;
$$;

create or replace function public.cliente_trocar_nome(p_token text, p_nome text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_tel text := public.vb_cliente_do_token(p_token);
begin
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Digite seu nome.'; end if;
  update public.vb_clientes_globais set nome = trim(p_nome), atualizado_em = now() where telefone = v_tel;
  return true;
end;
$$;

-- ---------- esqueci a senha ----------
-- o estabelecimento gera um código pra um cliente dele (que já agendou ou
-- pediu lá) e manda pelo WhatsApp; vale 15 minutos, 5 tentativas
create or replace function public.tenant_admin_codigo_cliente(p_estabelecimento_id uuid, p_telefone text) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_tel text := public.vb_tel(p_telefone); v_cod text;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  if not exists (select 1 from public.tenant_clients where estabelecimento_id = p_estabelecimento_id and public.vb_tel(telefone) = v_tel)
     and not exists (select 1 from public.tenant_appointments where estabelecimento_id = p_estabelecimento_id and public.vb_tel(cliente_telefone) = v_tel) then
    raise exception 'Esse WhatsApp não é de um cliente seu.';
  end if;
  v_cod := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into public.vb_cliente_codigos (telefone, codigo_hash, expira_em, tentativas, gerado_por)
  values (v_tel, extensions.crypt(v_cod, extensions.gen_salt('bf', 6)), now() + interval '15 minutes', 0, auth.uid())
  on conflict (telefone) do update set codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, tentativas = 0, gerado_por = excluded.gerado_por;
  return v_cod;
end;
$$;

create or replace function public.cliente_redefinir_senha(p_telefone text, p_codigo text, p_pin text) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_tel text := public.vb_tel(p_telefone); v public.vb_cliente_codigos; v_nome text;
begin
  select * into v from public.vb_cliente_codigos where telefone = v_tel;
  if v.telefone is null or v.expira_em < now() then raise exception 'Código vencido. Peça outro.'; end if;
  if v.tentativas >= 5 then raise exception 'Muitas tentativas. Peça outro código.'; end if;
  if extensions.crypt(coalesce(p_codigo, ''), v.codigo_hash) <> v.codigo_hash then
    update public.vb_cliente_codigos set tentativas = tentativas + 1 where telefone = v_tel;
    raise exception 'Código errado.';
  end if;
  if coalesce(p_pin, '') !~ '^\d{6}$' then raise exception 'A senha tem 6 números.'; end if;
  if p_pin ~ '^(\d)\1{5}$' or p_pin in ('123456', '654321', '012345') then raise exception 'Essa senha é fácil demais — escolha outra.'; end if;
  update public.vb_cliente_codigos set expira_em = now() where telefone = v_tel;
  select nome into v_nome from public.vb_clientes_globais where telefone = v_tel;
  insert into public.vb_clientes_globais (telefone, nome, pin_hash, atualizado_em)
  values (v_tel, coalesce(v_nome, 'Cliente'), extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), now())
  on conflict (telefone) do update set pin_hash = excluded.pin_hash, pin_erros = 0, bloqueado_ate = null, atualizado_em = now();
  -- quem tinha entrado em outros aparelhos sai de lá
  update public.vb_cliente_sessoes set expira_em = now() where telefone = v_tel and expira_em > now();
  return jsonb_build_object('telefone', v_tel, 'nome', coalesce(v_nome, 'Cliente'), 'token', public.vb_cliente_nova_sessao(v_tel));
end;
$$;

-- ---------- agendamentos do cliente (com sessão) ----------
create or replace function public.cliente_meus_agendamentos(p_token text)
returns table(id uuid, estabelecimento_id uuid, estabelecimento_nome text, estabelecimento_slug text, estabelecimento_cidade text, staff_id uuid, staff_nome text, servico text, dia date, dia_label text, horario text, status text, criado_em timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_tel text := public.vb_cliente_do_token(p_token);
begin
  return query
  select a.id, a.estabelecimento_id, e.nome, e.slug, e.cidade, a.staff_id, a.staff_nome, a.servico, a.dia, a.dia_label, a.horario, a.status, a.criado_em
  from public.tenant_appointments a join public.estabelecimentos e on e.id = a.estabelecimento_id
  where public.vb_tel(a.cliente_telefone) = v_tel
  order by a.dia desc, a.horario desc;
end;
$$;

create or replace function public.cliente_cancelar_seguro(p_id uuid, p_token text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_tel text := public.vb_cliente_do_token(p_token); v_ok boolean := false;
begin
  update public.tenant_appointments set status = 'cancelado'
  where id = p_id and public.vb_tel(cliente_telefone) = v_tel and status <> 'cancelado'
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

create or replace function public.cliente_reagendar_seguro(p_id uuid, p_token text, p_dia date, p_dia_label text, p_horario text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_tel text := public.vb_cliente_do_token(p_token); v_estab uuid; v_staff uuid; v_dur int; v_ok boolean := false;
begin
  select estabelecimento_id, staff_id, duracao_min into v_estab, v_staff, v_dur
  from public.tenant_appointments where id = p_id and public.vb_tel(cliente_telefone) = v_tel and status <> 'cancelado';
  if v_estab is null then raise exception 'Agendamento não encontrado.'; end if;
  if coalesce(trim(p_horario), '') = '' or p_dia is null then raise exception 'Escolha o dia e o horário.'; end if;
  if p_dia < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Esse dia já passou — escolha outro.'; end if;
  if not exists (select 1 from public.vibe_agenda_slots_duracao(v_estab, p_dia, v_staff, v_dur) s where s.horario = p_horario)
     or public.vibe_agenda_ocupada(v_estab, p_dia, v_staff, p_horario::time, v_dur, p_id) then
    raise exception 'Esse horário acabou de ficar indisponível — escolha outro.';
  end if;
  begin
    update public.tenant_appointments set dia = p_dia, dia_label = p_dia_label, horario = p_horario
    where id = p_id returning true into v_ok;
  exception when unique_violation then
    raise exception 'Esse horário acabou de ficar indisponível — escolha outro.';
  end;
  return coalesce(v_ok, false);
end;
$$;

create or replace function public.cliente_trocar_servico_seguro(p_id uuid, p_token text, p_servico text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_tel text := public.vb_cliente_do_token(p_token); v_ag public.tenant_appointments; v_dur int; v_ok boolean := false;
begin
  select * into v_ag from public.tenant_appointments where id = p_id and public.vb_tel(cliente_telefone) = v_tel and status <> 'cancelado';
  if v_ag.id is null then return false; end if;
  v_dur := public.vibe_duracao_servico(v_ag.estabelecimento_id, p_servico);
  if v_dur > v_ag.duracao_min and v_ag.horario ~ '^\d{1,2}:\d{2}$'
     and public.vibe_agenda_ocupada(v_ag.estabelecimento_id, v_ag.dia, v_ag.staff_id, v_ag.horario::time, v_dur, v_ag.id) then
    raise exception 'Esse serviço é mais demorado e não cabe nesse horário — remarque pra um horário com mais tempo livre.';
  end if;
  update public.tenant_appointments set servico = p_servico, duracao_min = v_dur where id = p_id returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

-- ---------- as antigas (só telefone) deixam de funcionar ----------
create or replace function public.cliente_listar_meus_agendamentos(p_telefone text)
returns table(id uuid, estabelecimento_id uuid, estabelecimento_nome text, estabelecimento_slug text, estabelecimento_cidade text, staff_id uuid, staff_nome text, servico text, dia date, dia_label text, horario text, status text, criado_em timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin raise exception 'Atualize a página e entre com sua senha.'; end;
$$;
create or replace function public.cliente_cancelar_agendamento(p_id uuid, p_telefone text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
begin raise exception 'Atualize a página e entre com sua senha.'; end;
$$;
create or replace function public.cliente_reagendar_agendamento(p_id uuid, p_telefone text, p_dia date, p_dia_label text, p_horario text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
begin raise exception 'Atualize a página e entre com sua senha.'; end;
$$;
create or replace function public.cliente_trocar_servico_agendamento(p_id uuid, p_telefone text, p_servico text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
begin raise exception 'Atualize a página e entre com sua senha.'; end;
$$;
-- nome de alguém pelo telefone: não devolve mais nada
create or replace function public.vb_buscar_cliente_global(p_telefone text)
returns table(telefone text, nome text)
language sql security definer set search_path to 'public' as $$
  select null::text, null::text where false;
$$;
-- "entrar só com o número" não cria/sobrescreve mais conta
create or replace function public.vb_login_cliente_global(p_telefone text, p_nome text)
returns table(telefone text, nome text)
language plpgsql security definer set search_path to 'public' as $$
begin raise exception 'Atualize a página e crie sua senha de 6 números.'; end;
$$;

grant execute on function public.cliente_status(text) to anon, authenticated;
grant execute on function public.cliente_criar_conta(text, text, text) to anon, authenticated;
grant execute on function public.cliente_entrar(text, text) to anon, authenticated;
grant execute on function public.cliente_sessao(text) to anon, authenticated;
grant execute on function public.cliente_sair(text) to anon, authenticated;
grant execute on function public.cliente_trocar_senha(text, text) to anon, authenticated;
grant execute on function public.cliente_trocar_nome(text, text) to anon, authenticated;
grant execute on function public.cliente_redefinir_senha(text, text, text) to anon, authenticated;
grant execute on function public.cliente_meus_agendamentos(text) to anon, authenticated;
grant execute on function public.cliente_cancelar_seguro(uuid, text) to anon, authenticated;
grant execute on function public.cliente_reagendar_seguro(uuid, text, date, text, text) to anon, authenticated;
grant execute on function public.cliente_trocar_servico_seguro(uuid, text, text) to anon, authenticated;
grant execute on function public.tenant_admin_codigo_cliente(uuid, text) to authenticated;
