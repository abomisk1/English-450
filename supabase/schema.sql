-- ============================================================================
--  English 450 — مخطّط الإحصائيات المجهولة (Supabase / PostgreSQL)
--  شغّل هذا الملف كاملًا مرّة واحدة في: Supabase → SQL Editor → New query → Run
-- ============================================================================
--
--  مبادئ الأمان:
--   • جدولان فقط، مع RLS مفعّل وبلا أي سياسة وصول مباشرة ⇒ لا أحد (anon/authenticated)
--     يستطيع القراءة أو الكتابة المباشرة على الجداول.
--   • الكتابة تتمّ حصريًا عبر دوال SECURITY DEFINER (track_user/track_level/track_program)
--     المصرّح لدور anon بتنفيذها فقط — لا وصول خام.
--   • القراءة (لوحة الإدارة) عبر دالة get_stats() المصرّح بها لدور authenticated فقط،
--     وتُعيد أرقامًا مجمّعة لا صفوفًا خام ⇒ المستخدم العادي لا يرى أي بيانات.
--   • لا يُستخدَم مفتاح service_role في الواجهة إطلاقًا؛ فقط المفتاح العام anon.
-- ============================================================================

-- ---------- الجداول ----------
create table if not exists public.users (
  anon_id              uuid primary key,
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now(),
  program_completed    boolean     not null default false,
  program_completed_at timestamptz
);

create table if not exists public.level_completions (
  anon_id      uuid not null,
  level        int  not null check (level between 1 and 6),
  completed_at timestamptz not null default now(),
  primary key (anon_id, level)   -- يمنع تكرار احتساب نفس المستخدم لنفس المستوى
);

create index if not exists idx_users_last_seen on public.users (last_seen_at);
create index if not exists idx_level_completions_level on public.level_completions (level);

-- ---------- تفعيل RLS بلا سياسات (يمنع كل وصول مباشر) ----------
alter table public.users             enable row level security;
alter table public.level_completions enable row level security;
-- (لا ننشئ أي policy عمدًا: النتيجة رفض كل SELECT/INSERT/UPDATE/DELETE المباشر.)

-- امنع أي وصول مباشر على مستوى الصلاحيات أيضًا (تحصين إضافي).
revoke all on public.users             from anon, authenticated;
revoke all on public.level_completions from anon, authenticated;

-- ---------- دوال الكتابة (SECURITY DEFINER — تتجاوز RLS بمنطق ثابت) ----------

-- تسجيل مستخدم مجهول عند أول استخدام، وتحديث آخر ظهور في كل زيارة.
create or replace function public.track_user(p_anon_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (anon_id, first_seen_at, last_seen_at)
  values (p_anon_id, now(), now())
  on conflict (anon_id) do update set last_seen_at = now();
end;
$$;

-- تسجيل إكمال مستوى مرّة واحدة فقط لكل (مستخدم، مستوى).
create or replace function public.track_level(p_anon_id uuid, p_level int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_level is null or p_level < 1 or p_level > 6 then
    return;
  end if;
  insert into public.users (anon_id) values (p_anon_id)
    on conflict (anon_id) do update set last_seen_at = now();
  insert into public.level_completions (anon_id, level)
  values (p_anon_id, p_level)
  on conflict (anon_id, level) do nothing;
end;
$$;

-- تسجيل إكمال البرنامج (450/450) مرّة واحدة فقط.
create or replace function public.track_program(p_anon_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (anon_id, program_completed, program_completed_at, last_seen_at)
  values (p_anon_id, true, now(), now())
  on conflict (anon_id) do update
    set program_completed    = true,
        program_completed_at = coalesce(public.users.program_completed_at, now()),
        last_seen_at         = now();
end;
$$;

-- ---------- دالة القراءة المجمّعة (للوحة الإدارة فقط) ----------
create or replace function public.get_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total_users',       (select count(*) from public.users),
    'active_7d',         (select count(*) from public.users where last_seen_at > now() - interval '7 days'),
    'active_30d',        (select count(*) from public.users where last_seen_at > now() - interval '30 days'),
    'program_completed', (select count(*) from public.users where program_completed),
    'levels',            (select coalesce(json_object_agg(level, cnt), '{}'::json)
                          from (select level, count(*) as cnt
                                from public.level_completions
                                group by level) t),
    'generated_at',      now()
  );
$$;

-- ---------- الصلاحيات على الدوال ----------
revoke all on function public.track_user(uuid)       from public;
revoke all on function public.track_level(uuid, int) from public;
revoke all on function public.track_program(uuid)    from public;
revoke all on function public.get_stats()            from public;

-- الكتابة: مسموحة لدور anon (والمستخدم المُصادَق) عبر الدوال فقط.
grant execute on function public.track_user(uuid)       to anon, authenticated;
grant execute on function public.track_level(uuid, int) to anon, authenticated;
grant execute on function public.track_program(uuid)    to anon, authenticated;

-- القراءة المجمّعة: مقصورة على المستخدم المُصادَق (لوحة الإدارة) — anon ممنوع.
grant execute on function public.get_stats() to authenticated;

-- ============================================================================
--  (اختياري) تحصين إضافي: قصر get_stats على بريد المشرف فقط.
--  إذا فعّلت التسجيل العام في Supabase Auth لأي سبب، أزل التعليق واضبط البريد،
--  ليصبح الوصول للوحة محصورًا بحسابك أنت حتى بين المستخدمين المُصادَقين.
-- ----------------------------------------------------------------------------
--  create or replace function public.get_stats()
--  returns json language sql security definer set search_path = public as $$
--    select case
--      when (auth.jwt() ->> 'email') = 'admin@example.com' then (
--        -- ... نفس جسم json_build_object أعلاه ...
--        json_build_object('total_users', (select count(*) from public.users))
--      )
--      else null
--    end;
--  $$;
-- ============================================================================
