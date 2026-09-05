-- =========================================================
-- TABLA DE INGRESOS / QR
-- =========================================================

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
-- RLS
-- =========================================================

alter table public.ingresos enable row level security;


-- =========================================================
-- POLÍTICAS
-- =========================================================

drop policy if exists "Permitir consultar ingresos"
on public.ingresos;

create policy "Permitir consultar ingresos"
on public.ingresos
for select
to anon, authenticated
using (true);


drop policy if exists "Permitir crear ingresos"
on public.ingresos;

create policy "Permitir crear ingresos"
on public.ingresos
for insert
to anon, authenticated
with check (true);


drop policy if exists "Permitir borrar ingresos"
on public.ingresos;

create policy "Permitir borrar ingresos"
on public.ingresos
for delete
to anon, authenticated
using (true);


-- =========================================================
-- FUNCIÓN PARA CONSUMIR QR
-- EL QR SOLO PUEDE USARSE UNA VEZ
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

    -- Buscar y bloquear el registro
    select *
    into registro
    from public.ingresos
    where token = p_token
    for update;

    -- QR inexistente
    if not found then

        return json_build_object(
            'ok', false,
            'mensaje', 'QR inválido o inexistente'
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
-- PERMISO PARA EJECUTAR LA FUNCIÓN
-- =========================================================

grant execute
on function public.consumir_qr(uuid)
to anon, authenticated;