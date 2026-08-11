-- =========================================================
-- SEGURIDAD DEL KIOSCO ESCOLAR
-- Pegar y ejecutar TODO este archivo en:
-- Supabase → tu proyecto → SQL Editor → New query → Run
-- =========================================================
-- Qué hace:
--   1) Crea una tabla "autorizados" con los emails que pueden usar el kiosco.
--   2) Activa Row Level Security (RLS) en "kiosco_datos" y "autorizados".
--   3) Crea políticas que SOLO dejan leer/escribir/borrar datos del kiosco
--      a usuarios logueados (con Google) cuyo email esté en "autorizados".
--
-- Importante: sin este script, cualquiera que abra la página (logueado o no)
-- puede leer y modificar los datos, porque la tabla "kiosco_datos" no tiene
-- ninguna restricción todavía.
-- =========================================================

-- 1) Tabla de emails autorizados -----------------------------------------
create table if not exists public.autorizados (
  email text primary key,
  agregado timestamptz not null default now()
);

-- 2) Activar RLS -----------------------------------------------------------
alter table public.kiosco_datos enable row level security;
alter table public.autorizados enable row level security;

-- 3) Limpiar políticas previas (por si ya existía alguna permisiva) --------
drop policy if exists "solo autorizados leen" on public.kiosco_datos;
drop policy if exists "solo autorizados insertan" on public.kiosco_datos;
drop policy if exists "solo autorizados actualizan" on public.kiosco_datos;
drop policy if exists "solo autorizados borran" on public.kiosco_datos;
drop policy if exists "cada usuario ve si esta autorizado" on public.autorizados;

-- 4) Políticas para kiosco_datos: solo usuarios logueados y autorizados ----
create policy "solo autorizados leen"
  on public.kiosco_datos
  for select
  to authenticated
  using (
    exists (select 1 from public.autorizados a where a.email = auth.jwt() ->> 'email')
  );

create policy "solo autorizados insertan"
  on public.kiosco_datos
  for insert
  to authenticated
  with check (
    exists (select 1 from public.autorizados a where a.email = auth.jwt() ->> 'email')
  );

create policy "solo autorizados actualizan"
  on public.kiosco_datos
  for update
  to authenticated
  using (
    exists (select 1 from public.autorizados a where a.email = auth.jwt() ->> 'email')
  )
  with check (
    exists (select 1 from public.autorizados a where a.email = auth.jwt() ->> 'email')
  );

create policy "solo autorizados borran"
  on public.kiosco_datos
  for delete
  to authenticated
  using (
    exists (select 1 from public.autorizados a where a.email = auth.jwt() ->> 'email')
  );

-- 5) Política para autorizados: cada usuario logueado solo puede ver
--    SU PROPIA fila (para que la app pueda chequear "¿estoy autorizado?"
--    sin exponer la lista completa de emails a nadie). No hay política de
--    insert/update/delete, así que la tabla solo se edita a mano desde el
--    dashboard de Supabase (Table Editor), nunca desde la página.
create policy "cada usuario ve si esta autorizado"
  on public.autorizados
  for select
  to authenticated
  using (email = auth.jwt() ->> 'email');

-- =========================================================
-- ÚLTIMO PASO (hacerlo a mano, no por SQL):
-- Ir a Table Editor → autorizados → Insert row, y cargar los 5 emails
-- de Gmail que van a poder usar el kiosco. Para dar de baja a alguien,
-- simplemente borrar su fila.
-- =========================================================
