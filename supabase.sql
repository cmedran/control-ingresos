-- =========================================================
-- TABLA PRINCIPAL
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.ingresos (
    id uuid primary key default gen_random_uuid(),

    dni text not null unique,

    token uuid not null unique default gen_random_uuid(),

    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'ingresado')),

    generado_en timestamptz not null default now(),

    ingresado_en timestamptz
);


-- =========================================================
-- FUNCIÓN PARA CONSUMIR EL QR
-- =========================================================

create or replace function public.consumir_qr(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    registro public.ingresos;
begin

    -- Busca y bloquea el registro mientras se procesa
    select *
    into registro
    from public.ingresos
    where token = p_token
    for update;

    -- QR inexistente
    if not found then
        return json_build_object(
            'ok', false,
            'mensaje', 'QR no válido'
        );
    end if;

    -- QR ya utilizado
    if registro.estado = 'ingresado' then
        return json_build_object(
            'ok', false,
            'mensaje', 'Este QR ya fue utilizado',
            'dni', registro.dni,
            'ingresado_en', registro.ingresado_en
        );
    end if;

    -- Marcar como ingresado
    update public.ingresos
    set
        estado = 'ingresado',
        ingresado_en = now()
    where id = registro.id;

    return json_build_object(
        'ok', true,
        'mensaje', 'Ingreso autorizado',
        'dni', registro.dni,
        'ingresado_en', now()
    );

end;
$$;


-- =========================================================
-- PERMISOS
-- =========================================================

grant execute on function public.consumir_qr(uuid)
to anon, authenticated;


-- =========================================================
-- RLS
-- =========================================================

alter table public.ingresos enable row level security;


-- CONSULTAR
drop policy if exists "Permitir consultar ingresos"
on public.ingresos;

create policy "Permitir consultar ingresos"
on public.ingresos
for select
to anon, authenticated
using (true);


-- INSERTAR
drop policy if exists "Permitir insertar ingresos"
on public.ingresos;

create policy "Permitir insertar ingresos"
on public.ingresos
for insert
to anon, authenticated
with check (true);


-- BORRAR
drop policy if exists "Permitir borrar ingresos"
on public.ingresos;

create policy "Permitir borrar ingresos"
on public.ingresos
for delete
to anon, authenticated
using (true);