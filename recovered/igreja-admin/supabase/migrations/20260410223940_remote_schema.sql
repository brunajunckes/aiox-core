create extension if not exists "postgis" with schema "public";

create extension if not exists "unaccent" with schema "public";

create type "public"."church_location_type" as enum ('casa', 'comercio', 'espaco_publico');

create type "public"."church_status" as enum ('pending', 'approved', 'rejected');

create type "public"."content_category" as enum ('fundamentos', 'vida_com_deus', 'lideranca', 'discipulado', 'plantacao');

create type "public"."content_type" as enum ('pdf', 'video', 'article', 'guide');

create type "public"."recurso_tipo" as enum ('pdf', 'video', 'link', 'audio');

create type "public"."reuniao_status" as enum ('agendada', 'realizada', 'cancelada');

create type "public"."user_role" as enum ('convidado', 'membro', 'lider', 'admin');

drop trigger if exists "update_churches_updated_at" on "public"."churches";

drop trigger if exists "update_donors_updated_at" on "public"."donors";

drop policy "audit_insert" on "public"."audit_logs";

drop policy "audit_read" on "public"."audit_logs";

drop policy "churches_read" on "public"."churches";

drop policy "donors_insert" on "public"."donors";

drop policy "donors_read" on "public"."donors";

drop policy "donors_update" on "public"."donors";

drop policy "otp_insert" on "public"."otp_verifications";

drop policy "otp_read" on "public"."otp_verifications";

drop policy "churches_insert" on "public"."churches";

drop policy "churches_update" on "public"."churches";

revoke delete on table "public"."audit_logs" from "anon";

revoke insert on table "public"."audit_logs" from "anon";

revoke references on table "public"."audit_logs" from "anon";

revoke select on table "public"."audit_logs" from "anon";

revoke trigger on table "public"."audit_logs" from "anon";

revoke truncate on table "public"."audit_logs" from "anon";

revoke update on table "public"."audit_logs" from "anon";

revoke delete on table "public"."audit_logs" from "authenticated";

revoke insert on table "public"."audit_logs" from "authenticated";

revoke references on table "public"."audit_logs" from "authenticated";

revoke select on table "public"."audit_logs" from "authenticated";

revoke trigger on table "public"."audit_logs" from "authenticated";

revoke truncate on table "public"."audit_logs" from "authenticated";

revoke update on table "public"."audit_logs" from "authenticated";

revoke delete on table "public"."audit_logs" from "service_role";

revoke insert on table "public"."audit_logs" from "service_role";

revoke references on table "public"."audit_logs" from "service_role";

revoke select on table "public"."audit_logs" from "service_role";

revoke trigger on table "public"."audit_logs" from "service_role";

revoke truncate on table "public"."audit_logs" from "service_role";

revoke update on table "public"."audit_logs" from "service_role";

revoke delete on table "public"."donors" from "anon";

revoke insert on table "public"."donors" from "anon";

revoke references on table "public"."donors" from "anon";

revoke select on table "public"."donors" from "anon";

revoke trigger on table "public"."donors" from "anon";

revoke truncate on table "public"."donors" from "anon";

revoke update on table "public"."donors" from "anon";

revoke delete on table "public"."donors" from "authenticated";

revoke insert on table "public"."donors" from "authenticated";

revoke references on table "public"."donors" from "authenticated";

revoke select on table "public"."donors" from "authenticated";

revoke trigger on table "public"."donors" from "authenticated";

revoke truncate on table "public"."donors" from "authenticated";

revoke update on table "public"."donors" from "authenticated";

revoke delete on table "public"."donors" from "service_role";

revoke insert on table "public"."donors" from "service_role";

revoke references on table "public"."donors" from "service_role";

revoke select on table "public"."donors" from "service_role";

revoke trigger on table "public"."donors" from "service_role";

revoke truncate on table "public"."donors" from "service_role";

revoke update on table "public"."donors" from "service_role";

revoke delete on table "public"."otp_verifications" from "anon";

revoke insert on table "public"."otp_verifications" from "anon";

revoke references on table "public"."otp_verifications" from "anon";

revoke select on table "public"."otp_verifications" from "anon";

revoke trigger on table "public"."otp_verifications" from "anon";

revoke truncate on table "public"."otp_verifications" from "anon";

revoke update on table "public"."otp_verifications" from "anon";

revoke delete on table "public"."otp_verifications" from "authenticated";

revoke insert on table "public"."otp_verifications" from "authenticated";

revoke references on table "public"."otp_verifications" from "authenticated";

revoke select on table "public"."otp_verifications" from "authenticated";

revoke trigger on table "public"."otp_verifications" from "authenticated";

revoke truncate on table "public"."otp_verifications" from "authenticated";

revoke update on table "public"."otp_verifications" from "authenticated";

revoke delete on table "public"."otp_verifications" from "service_role";

revoke insert on table "public"."otp_verifications" from "service_role";

revoke references on table "public"."otp_verifications" from "service_role";

revoke select on table "public"."otp_verifications" from "service_role";

revoke trigger on table "public"."otp_verifications" from "service_role";

revoke truncate on table "public"."otp_verifications" from "service_role";

revoke update on table "public"."otp_verifications" from "service_role";

alter table "public"."churches" drop constraint "churches_cnpj_key";

alter table "public"."churches" drop constraint "churches_status_check";

alter table "public"."churches" drop constraint "valid_cep";

alter table "public"."churches" drop constraint "valid_email";

alter table "public"."churches" drop constraint "valid_phone";

alter table "public"."donors" drop constraint "donors_email_key";

alter table "public"."donors" drop constraint "donors_kyc_status_check";

alter table "public"."donors" drop constraint "valid_document_id";

alter table "public"."donors" drop constraint "valid_email";

alter table "public"."otp_verifications" drop constraint "valid_email";

alter table "public"."otp_verifications" drop constraint "valid_otp";

drop function if exists "public"."update_updated_at_column"();

alter table "public"."audit_logs" drop constraint "audit_logs_pkey";

alter table "public"."donors" drop constraint "donors_pkey";

alter table "public"."otp_verifications" drop constraint "otp_verifications_pkey";

drop index if exists "public"."audit_logs_pkey";

drop index if exists "public"."churches_cnpj_key";

drop index if exists "public"."donors_email_key";

drop index if exists "public"."donors_pkey";

drop index if exists "public"."idx_audit_created_at";

drop index if exists "public"."idx_audit_entity";

drop index if exists "public"."idx_churches_cnpj";

drop index if exists "public"."idx_churches_created_at";

drop index if exists "public"."idx_churches_email";

drop index if exists "public"."idx_churches_status";

drop index if exists "public"."idx_donors_created_at";

drop index if exists "public"."idx_donors_document_id";

drop index if exists "public"."idx_donors_email";

drop index if exists "public"."idx_donors_kyc_status";

drop index if exists "public"."idx_otp_created_at";

drop index if exists "public"."idx_otp_email";

drop index if exists "public"."idx_otp_expires_at";

drop index if exists "public"."otp_verifications_pkey";

drop table "public"."audit_logs";

drop table "public"."donors";

drop table "public"."otp_verifications";


  create table "public"."anuncios" (
    "id" uuid not null default gen_random_uuid(),
    "igreja_home_id" uuid not null,
    "titulo" text not null,
    "conteudo" text not null,
    "tipo" text not null default 'geral'::text,
    "criado_por" uuid,
    "expira_em" timestamp with time zone,
    "criado_em" timestamp with time zone default now()
      );


alter table "public"."anuncios" enable row level security;


  create table "public"."banners" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "subtitle" text,
    "cta_label" text,
    "cta_url" text,
    "image_url" text not null,
    "active" boolean not null default true,
    "order_index" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."banners" enable row level security;


  create table "public"."blog_posts" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "slug" text not null,
    "excerpt" text not null,
    "content" text not null,
    "cover_url" text,
    "category" text not null,
    "tags" text[] default '{}'::text[],
    "published" boolean not null default false,
    "published_at" timestamp with time zone,
    "seo_title" text,
    "seo_description" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."blog_posts" enable row level security;


  create table "public"."church_reviews" (
    "id" uuid not null default gen_random_uuid(),
    "church_id" uuid not null,
    "user_id" uuid not null,
    "rating" smallint not null,
    "comment" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."church_reviews" enable row level security;


  create table "public"."community_groups" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "avatar_url" text,
    "is_public" boolean not null default true,
    "created_by" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."community_groups" enable row level security;


  create table "public"."content" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text not null,
    "type" public.content_type not null,
    "category" public.content_category not null,
    "url" text not null,
    "thumbnail_url" text,
    "level" integer default 1,
    "published" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."content" enable row level security;


  create table "public"."content_progress" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "content_id" uuid not null,
    "completed" boolean default false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."content_progress" enable row level security;


  create table "public"."convites" (
    "id" uuid not null default gen_random_uuid(),
    "token" text not null default (gen_random_uuid())::text,
    "igreja_home_id" uuid not null,
    "criado_por" uuid,
    "usado" boolean not null default false,
    "usado_por" uuid,
    "usado_em" timestamp with time zone,
    "expira_em" timestamp with time zone not null default (now() + '7 days'::interval),
    "criado_em" timestamp with time zone not null default now()
      );


alter table "public"."convites" enable row level security;


  create table "public"."direct_messages" (
    "id" uuid not null default gen_random_uuid(),
    "sender_id" uuid not null,
    "receiver_id" uuid not null,
    "content" text not null,
    "read_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."direct_messages" enable row level security;


  create table "public"."favorites" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "content_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."favorites" enable row level security;


  create table "public"."follows" (
    "id" uuid not null default gen_random_uuid(),
    "follower_id" uuid not null,
    "following_id" uuid not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."follows" enable row level security;


  create table "public"."group_members" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null default 'member'::text,
    "joined_at" timestamp with time zone default now()
      );


alter table "public"."group_members" enable row level security;


  create table "public"."group_messages" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "sender_id" uuid,
    "content" text not null,
    "deleted_at" timestamp with time zone,
    "deleted_by" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."group_messages" enable row level security;


  create table "public"."igrejas_home" (
    "id" uuid not null default gen_random_uuid(),
    "nome" text not null,
    "descricao" text,
    "cidade" text not null,
    "estado" text not null,
    "lider_id" uuid,
    "criado_em" timestamp with time zone not null default now(),
    "atualizado_em" timestamp with time zone not null default now()
      );


alter table "public"."igrejas_home" enable row level security;


  create table "public"."membros_pendentes" (
    "id" uuid not null default gen_random_uuid(),
    "convite_id" uuid,
    "igreja_home_id" uuid not null,
    "user_id" uuid not null,
    "nome" text not null,
    "email" text not null,
    "telefone" text,
    "aprovado" boolean,
    "avaliado_por" uuid,
    "avaliado_em" timestamp with time zone,
    "criado_em" timestamp with time zone not null default now()
      );


alter table "public"."membros_pendentes" enable row level security;


  create table "public"."ministerio_membros" (
    "id" uuid not null default gen_random_uuid(),
    "ministerio_id" uuid not null,
    "user_id" uuid not null,
    "funcao" text,
    "criado_em" timestamp with time zone default now()
      );


alter table "public"."ministerio_membros" enable row level security;


  create table "public"."ministerios" (
    "id" uuid not null default gen_random_uuid(),
    "igreja_home_id" uuid not null,
    "nome" text not null,
    "descricao" text,
    "responsavel_id" uuid,
    "criado_em" timestamp with time zone default now()
      );


alter table "public"."ministerios" enable row level security;


  create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "type" text not null,
    "title" text not null,
    "body" text,
    "link" text,
    "read_at" timestamp with time zone,
    "actor_id" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."notifications" enable row level security;


  create table "public"."prayer_requests" (
    "id" uuid not null default gen_random_uuid(),
    "church_id" uuid not null,
    "user_id" uuid not null,
    "title" text not null,
    "content" text not null,
    "is_anonymous" boolean not null default false,
    "is_answered" boolean not null default false,
    "answered_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."prayer_requests" enable row level security;


  create table "public"."prayer_supports" (
    "id" uuid not null default gen_random_uuid(),
    "prayer_request_id" uuid not null,
    "user_id" uuid not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."prayer_supports" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "full_name" text,
    "avatar_url" text,
    "bio" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "role" public.user_role not null default 'membro'::public.user_role,
    "telefone" text,
    "igreja_home_id" uuid
      );


alter table "public"."profiles" enable row level security;


  create table "public"."recursos" (
    "id" uuid not null default gen_random_uuid(),
    "igreja_home_id" uuid,
    "titulo" text not null,
    "descricao" text,
    "tipo" public.recurso_tipo not null,
    "url" text not null,
    "publicado" boolean not null default true,
    "criado_por" uuid,
    "criado_em" timestamp with time zone not null default now()
      );


alter table "public"."recursos" enable row level security;


  create table "public"."reuniao_attendance" (
    "id" uuid not null default gen_random_uuid(),
    "reuniao_id" uuid not null,
    "user_id" uuid not null,
    "rsvp" boolean default false,
    "presente" boolean,
    "criado_em" timestamp with time zone default now()
      );


alter table "public"."reuniao_attendance" enable row level security;


  create table "public"."reunioes" (
    "id" uuid not null default gen_random_uuid(),
    "igreja_home_id" uuid not null,
    "titulo" text not null,
    "descricao" text,
    "data_hora" timestamp with time zone not null,
    "local" text,
    "status" public.reuniao_status not null default 'agendada'::public.reuniao_status,
    "criado_por" uuid,
    "criado_em" timestamp with time zone not null default now(),
    "atualizado_em" timestamp with time zone not null default now()
      );


alter table "public"."reunioes" enable row level security;


  create table "public"."settings" (
    "key" text not null,
    "value" text,
    "label" text,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."settings" enable row level security;


  create table "public"."testimonials" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "church_id" uuid,
    "author_name" text not null,
    "content" text not null,
    "role_label" text,
    "approved" boolean default false,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."testimonials" enable row level security;

alter table "public"."churches" drop column "cep";

alter table "public"."churches" drop column "cnpj";

alter table "public"."churches" drop column "email";

alter table "public"."churches" drop column "legal_name";

alter table "public"."churches" drop column "phone";

alter table "public"."churches" drop column "verified_at";

alter table "public"."churches" drop column "wallet_address";

alter table "public"."churches" add column "contact_email" text;

alter table "public"."churches" add column "contact_whatsapp" text;

alter table "public"."churches" add column "country" text not null default 'Brasil'::text;

alter table "public"."churches" add column "description" text not null;

alter table "public"."churches" add column "instagram_url" text;

alter table "public"."churches" add column "lat" double precision;

alter table "public"."churches" add column "leader_name" text not null;

alter table "public"."churches" add column "lng" double precision;

alter table "public"."churches" add column "location" public.geography(Point,4326);

alter table "public"."churches" add column "location_type" public.church_location_type not null;

alter table "public"."churches" add column "meeting_days" text[] not null default '{}'::text[];

alter table "public"."churches" add column "meeting_frequency" text;

alter table "public"."churches" add column "meeting_time" text;

alter table "public"."churches" add column "photo_url" text;

alter table "public"."churches" add column "slug" text;

alter table "public"."churches" add column "tiktok_url" text;

alter table "public"."churches" add column "twitter_url" text;

alter table "public"."churches" add column "user_id" uuid not null;

alter table "public"."churches" add column "website_url" text;

alter table "public"."churches" add column "youtube_url" text;

alter table "public"."churches" alter column "address" drop not null;

alter table "public"."churches" alter column "address" set data type text using "address"::text;

alter table "public"."churches" alter column "city" set data type text using "city"::text;

alter table "public"."churches" alter column "created_at" set default now();

alter table "public"."churches" alter column "created_at" set not null;

alter table "public"."churches" alter column "created_at" set data type timestamp with time zone using "created_at"::timestamp with time zone;

alter table "public"."churches" alter column "state" set data type text using "state"::text;

alter table "public"."churches" alter column "status" set default 'pending'::public.church_status;

alter table "public"."churches" alter column "status" set not null;

alter table "public"."churches" alter column "status" set data type public.church_status using "status"::public.church_status;

alter table "public"."churches" alter column "updated_at" set default now();

alter table "public"."churches" alter column "updated_at" set not null;

alter table "public"."churches" alter column "updated_at" set data type timestamp with time zone using "updated_at"::timestamp with time zone;

CREATE UNIQUE INDEX anuncios_pkey ON public.anuncios USING btree (id);

CREATE UNIQUE INDEX banners_pkey ON public.banners USING btree (id);

CREATE INDEX blog_category_idx ON public.blog_posts USING btree (category);

CREATE UNIQUE INDEX blog_posts_pkey ON public.blog_posts USING btree (id);

CREATE UNIQUE INDEX blog_posts_slug_key ON public.blog_posts USING btree (slug);

CREATE INDEX blog_published_idx ON public.blog_posts USING btree (published, published_at DESC);

CREATE INDEX blog_slug_idx ON public.blog_posts USING btree (slug);

CREATE UNIQUE INDEX church_reviews_church_id_user_id_key ON public.church_reviews USING btree (church_id, user_id);

CREATE UNIQUE INDEX church_reviews_pkey ON public.church_reviews USING btree (id);

CREATE INDEX churches_city_idx ON public.churches USING btree (city);

CREATE INDEX churches_location_idx ON public.churches USING gist (location);

CREATE INDEX churches_slug_idx ON public.churches USING btree (slug);

CREATE UNIQUE INDEX churches_slug_key ON public.churches USING btree (slug);

CREATE INDEX churches_status_idx ON public.churches USING btree (status);

CREATE INDEX churches_user_idx ON public.churches USING btree (user_id);

CREATE UNIQUE INDEX community_groups_pkey ON public.community_groups USING btree (id);

CREATE INDEX content_category_idx ON public.content USING btree (category);

CREATE UNIQUE INDEX content_pkey ON public.content USING btree (id);

CREATE UNIQUE INDEX content_progress_pkey ON public.content_progress USING btree (id);

CREATE UNIQUE INDEX content_progress_user_id_content_id_key ON public.content_progress USING btree (user_id, content_id);

CREATE INDEX content_progress_user_id_idx ON public.content_progress USING btree (user_id);

CREATE INDEX content_published_idx ON public.content USING btree (published);

CREATE INDEX convites_igreja_idx ON public.convites USING btree (igreja_home_id);

CREATE UNIQUE INDEX convites_pkey ON public.convites USING btree (id);

CREATE INDEX convites_token_idx ON public.convites USING btree (token);

CREATE UNIQUE INDEX convites_token_key ON public.convites USING btree (token);

CREATE UNIQUE INDEX direct_messages_pkey ON public.direct_messages USING btree (id);

CREATE UNIQUE INDEX favorites_pkey ON public.favorites USING btree (id);

CREATE UNIQUE INDEX favorites_user_id_content_id_key ON public.favorites USING btree (user_id, content_id);

CREATE UNIQUE INDEX follows_follower_id_following_id_key ON public.follows USING btree (follower_id, following_id);

CREATE INDEX follows_follower_idx ON public.follows USING btree (follower_id);

CREATE INDEX follows_following_idx ON public.follows USING btree (following_id);

CREATE UNIQUE INDEX follows_pkey ON public.follows USING btree (id);

CREATE UNIQUE INDEX group_members_group_id_user_id_key ON public.group_members USING btree (group_id, user_id);

CREATE UNIQUE INDEX group_members_pkey ON public.group_members USING btree (id);

CREATE UNIQUE INDEX group_messages_pkey ON public.group_messages USING btree (id);

CREATE INDEX igrejas_home_lider_idx ON public.igrejas_home USING btree (lider_id);

CREATE UNIQUE INDEX igrejas_home_pkey ON public.igrejas_home USING btree (id);

CREATE UNIQUE INDEX membros_pendentes_pkey ON public.membros_pendentes USING btree (id);

CREATE UNIQUE INDEX membros_pendentes_user_id_igreja_home_id_key ON public.membros_pendentes USING btree (user_id, igreja_home_id);

CREATE UNIQUE INDEX ministerio_membros_ministerio_id_user_id_key ON public.ministerio_membros USING btree (ministerio_id, user_id);

CREATE UNIQUE INDEX ministerio_membros_pkey ON public.ministerio_membros USING btree (id);

CREATE UNIQUE INDEX ministerios_pkey ON public.ministerios USING btree (id);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE INDEX notifications_unread_idx ON public.notifications USING btree (user_id, read_at) WHERE (read_at IS NULL);

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);

CREATE INDEX prayer_requests_church_id_idx ON public.prayer_requests USING btree (church_id);

CREATE UNIQUE INDEX prayer_requests_pkey ON public.prayer_requests USING btree (id);

CREATE INDEX prayer_requests_user_id_idx ON public.prayer_requests USING btree (user_id);

CREATE UNIQUE INDEX prayer_supports_pkey ON public.prayer_supports USING btree (id);

CREATE UNIQUE INDEX prayer_supports_prayer_request_id_user_id_key ON public.prayer_supports USING btree (prayer_request_id, user_id);

CREATE INDEX prayer_supports_request_id_idx ON public.prayer_supports USING btree (prayer_request_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE INDEX recursos_igreja_idx ON public.recursos USING btree (igreja_home_id);

CREATE UNIQUE INDEX recursos_pkey ON public.recursos USING btree (id);

CREATE UNIQUE INDEX reuniao_attendance_pkey ON public.reuniao_attendance USING btree (id);

CREATE UNIQUE INDEX reuniao_attendance_reuniao_id_user_id_key ON public.reuniao_attendance USING btree (reuniao_id, user_id);

CREATE INDEX reuniao_attendance_reuniao_idx ON public.reuniao_attendance USING btree (reuniao_id);

CREATE INDEX reunioes_data_idx ON public.reunioes USING btree (data_hora);

CREATE INDEX reunioes_igreja_idx ON public.reunioes USING btree (igreja_home_id);

CREATE UNIQUE INDEX reunioes_pkey ON public.reunioes USING btree (id);

CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (key);

CREATE INDEX testimonials_approved_idx ON public.testimonials USING btree (approved);

CREATE UNIQUE INDEX testimonials_pkey ON public.testimonials USING btree (id);

alter table "public"."anuncios" add constraint "anuncios_pkey" PRIMARY KEY using index "anuncios_pkey";

alter table "public"."banners" add constraint "banners_pkey" PRIMARY KEY using index "banners_pkey";

alter table "public"."blog_posts" add constraint "blog_posts_pkey" PRIMARY KEY using index "blog_posts_pkey";

alter table "public"."church_reviews" add constraint "church_reviews_pkey" PRIMARY KEY using index "church_reviews_pkey";

alter table "public"."community_groups" add constraint "community_groups_pkey" PRIMARY KEY using index "community_groups_pkey";

alter table "public"."content" add constraint "content_pkey" PRIMARY KEY using index "content_pkey";

alter table "public"."content_progress" add constraint "content_progress_pkey" PRIMARY KEY using index "content_progress_pkey";

alter table "public"."convites" add constraint "convites_pkey" PRIMARY KEY using index "convites_pkey";

alter table "public"."direct_messages" add constraint "direct_messages_pkey" PRIMARY KEY using index "direct_messages_pkey";

alter table "public"."favorites" add constraint "favorites_pkey" PRIMARY KEY using index "favorites_pkey";

alter table "public"."follows" add constraint "follows_pkey" PRIMARY KEY using index "follows_pkey";

alter table "public"."group_members" add constraint "group_members_pkey" PRIMARY KEY using index "group_members_pkey";

alter table "public"."group_messages" add constraint "group_messages_pkey" PRIMARY KEY using index "group_messages_pkey";

alter table "public"."igrejas_home" add constraint "igrejas_home_pkey" PRIMARY KEY using index "igrejas_home_pkey";

alter table "public"."membros_pendentes" add constraint "membros_pendentes_pkey" PRIMARY KEY using index "membros_pendentes_pkey";

alter table "public"."ministerio_membros" add constraint "ministerio_membros_pkey" PRIMARY KEY using index "ministerio_membros_pkey";

alter table "public"."ministerios" add constraint "ministerios_pkey" PRIMARY KEY using index "ministerios_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."prayer_requests" add constraint "prayer_requests_pkey" PRIMARY KEY using index "prayer_requests_pkey";

alter table "public"."prayer_supports" add constraint "prayer_supports_pkey" PRIMARY KEY using index "prayer_supports_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."recursos" add constraint "recursos_pkey" PRIMARY KEY using index "recursos_pkey";

alter table "public"."reuniao_attendance" add constraint "reuniao_attendance_pkey" PRIMARY KEY using index "reuniao_attendance_pkey";

alter table "public"."reunioes" add constraint "reunioes_pkey" PRIMARY KEY using index "reunioes_pkey";

alter table "public"."settings" add constraint "settings_pkey" PRIMARY KEY using index "settings_pkey";

alter table "public"."testimonials" add constraint "testimonials_pkey" PRIMARY KEY using index "testimonials_pkey";

alter table "public"."anuncios" add constraint "anuncios_criado_por_fkey" FOREIGN KEY (criado_por) REFERENCES auth.users(id) not valid;

alter table "public"."anuncios" validate constraint "anuncios_criado_por_fkey";

alter table "public"."anuncios" add constraint "anuncios_igreja_home_id_fkey" FOREIGN KEY (igreja_home_id) REFERENCES public.igrejas_home(id) ON DELETE CASCADE not valid;

alter table "public"."anuncios" validate constraint "anuncios_igreja_home_id_fkey";

alter table "public"."anuncios" add constraint "anuncios_tipo_check" CHECK ((tipo = ANY (ARRAY['geral'::text, 'urgente'::text, 'evento'::text, 'devocional'::text]))) not valid;

alter table "public"."anuncios" validate constraint "anuncios_tipo_check";

alter table "public"."blog_posts" add constraint "blog_posts_slug_key" UNIQUE using index "blog_posts_slug_key";

alter table "public"."church_reviews" add constraint "church_reviews_church_id_fkey" FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE not valid;

alter table "public"."church_reviews" validate constraint "church_reviews_church_id_fkey";

alter table "public"."church_reviews" add constraint "church_reviews_church_id_user_id_key" UNIQUE using index "church_reviews_church_id_user_id_key";

alter table "public"."church_reviews" add constraint "church_reviews_rating_check" CHECK (((rating >= 1) AND (rating <= 5))) not valid;

alter table "public"."church_reviews" validate constraint "church_reviews_rating_check";

alter table "public"."church_reviews" add constraint "church_reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."church_reviews" validate constraint "church_reviews_user_id_fkey";

alter table "public"."churches" add constraint "churches_slug_key" UNIQUE using index "churches_slug_key";

alter table "public"."churches" add constraint "churches_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."churches" validate constraint "churches_user_id_fkey";

alter table "public"."community_groups" add constraint "community_groups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."community_groups" validate constraint "community_groups_created_by_fkey";

alter table "public"."content" add constraint "content_level_check" CHECK (((level >= 1) AND (level <= 3))) not valid;

alter table "public"."content" validate constraint "content_level_check";

alter table "public"."content_progress" add constraint "content_progress_content_id_fkey" FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE CASCADE not valid;

alter table "public"."content_progress" validate constraint "content_progress_content_id_fkey";

alter table "public"."content_progress" add constraint "content_progress_user_id_content_id_key" UNIQUE using index "content_progress_user_id_content_id_key";

alter table "public"."content_progress" add constraint "content_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."content_progress" validate constraint "content_progress_user_id_fkey";

alter table "public"."convites" add constraint "convites_criado_por_fkey" FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."convites" validate constraint "convites_criado_por_fkey";

alter table "public"."convites" add constraint "convites_igreja_home_id_fkey" FOREIGN KEY (igreja_home_id) REFERENCES public.igrejas_home(id) ON DELETE CASCADE not valid;

alter table "public"."convites" validate constraint "convites_igreja_home_id_fkey";

alter table "public"."convites" add constraint "convites_token_key" UNIQUE using index "convites_token_key";

alter table "public"."convites" add constraint "convites_usado_por_fkey" FOREIGN KEY (usado_por) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."convites" validate constraint "convites_usado_por_fkey";

alter table "public"."direct_messages" add constraint "direct_messages_content_check" CHECK ((length(TRIM(BOTH FROM content)) > 0)) not valid;

alter table "public"."direct_messages" validate constraint "direct_messages_content_check";

alter table "public"."direct_messages" add constraint "direct_messages_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."direct_messages" validate constraint "direct_messages_receiver_id_fkey";

alter table "public"."direct_messages" add constraint "direct_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."direct_messages" validate constraint "direct_messages_sender_id_fkey";

alter table "public"."favorites" add constraint "favorites_content_id_fkey" FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_content_id_fkey";

alter table "public"."favorites" add constraint "favorites_user_id_content_id_key" UNIQUE using index "favorites_user_id_content_id_key";

alter table "public"."favorites" add constraint "favorites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_user_id_fkey";

alter table "public"."follows" add constraint "follows_check" CHECK ((follower_id <> following_id)) not valid;

alter table "public"."follows" validate constraint "follows_check";

alter table "public"."follows" add constraint "follows_follower_id_fkey" FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."follows" validate constraint "follows_follower_id_fkey";

alter table "public"."follows" add constraint "follows_follower_id_following_id_key" UNIQUE using index "follows_follower_id_following_id_key";

alter table "public"."follows" add constraint "follows_following_id_fkey" FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."follows" validate constraint "follows_following_id_fkey";

alter table "public"."group_members" add constraint "group_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.community_groups(id) ON DELETE CASCADE not valid;

alter table "public"."group_members" validate constraint "group_members_group_id_fkey";

alter table "public"."group_members" add constraint "group_members_group_id_user_id_key" UNIQUE using index "group_members_group_id_user_id_key";

alter table "public"."group_members" add constraint "group_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]))) not valid;

alter table "public"."group_members" validate constraint "group_members_role_check";

alter table "public"."group_members" add constraint "group_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."group_members" validate constraint "group_members_user_id_fkey";

alter table "public"."group_messages" add constraint "group_messages_content_check" CHECK ((length(TRIM(BOTH FROM content)) > 0)) not valid;

alter table "public"."group_messages" validate constraint "group_messages_content_check";

alter table "public"."group_messages" add constraint "group_messages_deleted_by_fkey" FOREIGN KEY (deleted_by) REFERENCES auth.users(id) not valid;

alter table "public"."group_messages" validate constraint "group_messages_deleted_by_fkey";

alter table "public"."group_messages" add constraint "group_messages_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.community_groups(id) ON DELETE CASCADE not valid;

alter table "public"."group_messages" validate constraint "group_messages_group_id_fkey";

alter table "public"."group_messages" add constraint "group_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."group_messages" validate constraint "group_messages_sender_id_fkey";

alter table "public"."igrejas_home" add constraint "igrejas_home_lider_id_fkey" FOREIGN KEY (lider_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."igrejas_home" validate constraint "igrejas_home_lider_id_fkey";

alter table "public"."membros_pendentes" add constraint "membros_pendentes_avaliado_por_fkey" FOREIGN KEY (avaliado_por) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."membros_pendentes" validate constraint "membros_pendentes_avaliado_por_fkey";

alter table "public"."membros_pendentes" add constraint "membros_pendentes_convite_id_fkey" FOREIGN KEY (convite_id) REFERENCES public.convites(id) ON DELETE CASCADE not valid;

alter table "public"."membros_pendentes" validate constraint "membros_pendentes_convite_id_fkey";

alter table "public"."membros_pendentes" add constraint "membros_pendentes_igreja_home_id_fkey" FOREIGN KEY (igreja_home_id) REFERENCES public.igrejas_home(id) ON DELETE CASCADE not valid;

alter table "public"."membros_pendentes" validate constraint "membros_pendentes_igreja_home_id_fkey";

alter table "public"."membros_pendentes" add constraint "membros_pendentes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."membros_pendentes" validate constraint "membros_pendentes_user_id_fkey";

alter table "public"."membros_pendentes" add constraint "membros_pendentes_user_id_igreja_home_id_key" UNIQUE using index "membros_pendentes_user_id_igreja_home_id_key";

alter table "public"."ministerio_membros" add constraint "ministerio_membros_ministerio_id_fkey" FOREIGN KEY (ministerio_id) REFERENCES public.ministerios(id) ON DELETE CASCADE not valid;

alter table "public"."ministerio_membros" validate constraint "ministerio_membros_ministerio_id_fkey";

alter table "public"."ministerio_membros" add constraint "ministerio_membros_ministerio_id_user_id_key" UNIQUE using index "ministerio_membros_ministerio_id_user_id_key";

alter table "public"."ministerio_membros" add constraint "ministerio_membros_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ministerio_membros" validate constraint "ministerio_membros_user_id_fkey";

alter table "public"."ministerios" add constraint "ministerios_igreja_home_id_fkey" FOREIGN KEY (igreja_home_id) REFERENCES public.igrejas_home(id) ON DELETE CASCADE not valid;

alter table "public"."ministerios" validate constraint "ministerios_igreja_home_id_fkey";

alter table "public"."ministerios" add constraint "ministerios_responsavel_id_fkey" FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) not valid;

alter table "public"."ministerios" validate constraint "ministerios_responsavel_id_fkey";

alter table "public"."notifications" add constraint "notifications_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."notifications" validate constraint "notifications_actor_id_fkey";

alter table "public"."notifications" add constraint "notifications_type_check" CHECK ((type = ANY (ARRAY['new_follower'::text, 'new_message'::text, 'prayer_support'::text, 'prayer_answered'::text, 'church_approved'::text, 'church_rejected'::text, 'member_joined'::text, 'group_message'::text, 'reuniao_reminder'::text, 'member_approved'::text]))) not valid;

alter table "public"."notifications" validate constraint "notifications_type_check";

alter table "public"."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_user_id_fkey";

alter table "public"."prayer_requests" add constraint "prayer_requests_church_id_fkey" FOREIGN KEY (church_id) REFERENCES public.igrejas_home(id) ON DELETE CASCADE not valid;

alter table "public"."prayer_requests" validate constraint "prayer_requests_church_id_fkey";

alter table "public"."prayer_requests" add constraint "prayer_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."prayer_requests" validate constraint "prayer_requests_user_id_fkey";

alter table "public"."prayer_supports" add constraint "prayer_supports_prayer_request_id_fkey" FOREIGN KEY (prayer_request_id) REFERENCES public.prayer_requests(id) ON DELETE CASCADE not valid;

alter table "public"."prayer_supports" validate constraint "prayer_supports_prayer_request_id_fkey";

alter table "public"."prayer_supports" add constraint "prayer_supports_prayer_request_id_user_id_key" UNIQUE using index "prayer_supports_prayer_request_id_user_id_key";

alter table "public"."prayer_supports" add constraint "prayer_supports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."prayer_supports" validate constraint "prayer_supports_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_igreja_home_fk" FOREIGN KEY (igreja_home_id) REFERENCES public.igrejas_home(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_igreja_home_fk";

alter table "public"."recursos" add constraint "recursos_criado_por_fkey" FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."recursos" validate constraint "recursos_criado_por_fkey";

alter table "public"."recursos" add constraint "recursos_igreja_home_id_fkey" FOREIGN KEY (igreja_home_id) REFERENCES public.igrejas_home(id) ON DELETE CASCADE not valid;

alter table "public"."recursos" validate constraint "recursos_igreja_home_id_fkey";

alter table "public"."reuniao_attendance" add constraint "reuniao_attendance_reuniao_id_fkey" FOREIGN KEY (reuniao_id) REFERENCES public.reunioes(id) ON DELETE CASCADE not valid;

alter table "public"."reuniao_attendance" validate constraint "reuniao_attendance_reuniao_id_fkey";

alter table "public"."reuniao_attendance" add constraint "reuniao_attendance_reuniao_id_user_id_key" UNIQUE using index "reuniao_attendance_reuniao_id_user_id_key";

alter table "public"."reuniao_attendance" add constraint "reuniao_attendance_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."reuniao_attendance" validate constraint "reuniao_attendance_user_id_fkey";

alter table "public"."reunioes" add constraint "reunioes_criado_por_fkey" FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."reunioes" validate constraint "reunioes_criado_por_fkey";

alter table "public"."reunioes" add constraint "reunioes_igreja_home_id_fkey" FOREIGN KEY (igreja_home_id) REFERENCES public.igrejas_home(id) ON DELETE CASCADE not valid;

alter table "public"."reunioes" validate constraint "reunioes_igreja_home_id_fkey";

alter table "public"."testimonials" add constraint "testimonials_church_id_fkey" FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE SET NULL not valid;

alter table "public"."testimonials" validate constraint "testimonials_church_id_fkey";

alter table "public"."testimonials" add constraint "testimonials_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."testimonials" validate constraint "testimonials_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.generate_church_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  base_slug  text;
  final_slug text;
  counter    int := 0;
begin
  base_slug := lower(
    regexp_replace(
      unaccent(
        coalesce(new.leader_name, 'igreja') || '-' || coalesce(new.city, 'brasil')
      ),
      '[^a-z0-9]+', '-', 'g'
    )
  );
  base_slug  := trim(both '-' from base_slug);
  final_slug := base_slug;

  while exists (
    select 1 from public.churches where slug = final_slug and id != new.id
  ) loop
    counter    := counter + 1;
    final_slug := base_slug || '-' || counter;
  end loop;

  new.slug := final_slug;
  return new;
end;
$function$
;

create type "public"."geometry_dump" as ("path" integer[], "geom" public.geometry);

CREATE OR REPLACE FUNCTION public.get_my_church_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ SELECT igreja_home_id FROM public.profiles WHERE id = auth.uid() LIMIT 1; $function$
;

CREATE OR REPLACE FUNCTION public.get_user_church(uid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select igreja_home_id from public.profiles where id = uid limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
 RETURNS public.user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select role from public.profiles where id = uid limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'membro')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid, uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1
    from public.group_members
    where group_id = gid
      and user_id  = uid
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_group_owner_or_admin(gid uuid, uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1
    from public.group_members
    where group_id = gid
      and user_id  = uid
      and role in ('owner', 'admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.notify_group_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  _sender_name text;
  _group_name  text;
  _member      record;
  _count       int := 0;
begin
  select coalesce(p.full_name, p.email, 'Alguém')
    into _sender_name
    from public.profiles p
   where p.id = NEW.sender_id;

  select coalesce(cg.name, 'Grupo')
    into _group_name
    from public.community_groups cg
   where cg.id = NEW.group_id;

  for _member in
    select gm.user_id
      from public.group_members gm
     where gm.group_id = NEW.group_id
       and gm.user_id != NEW.sender_id
     limit 50
  loop
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (
      _member.user_id,
      'group_message',
      _group_name,
      coalesce(_sender_name, 'Alguém') || ': ' || left(NEW.content, 60),
      '/comunidade/' || NEW.group_id,
      NEW.sender_id
    );

    _count := _count + 1;
  end loop;

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_member_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- only fire when aprovado changes to TRUE
  if NEW.aprovado is true and (OLD.aprovado is distinct from true) then
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (
      NEW.user_id,
      'member_approved',
      'Solicitação aprovada!',
      'Você foi aprovado como membro da Igreja Home',
      '/dashboard/membro',
      NEW.avaliado_por
    );
  end if;

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_follower()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  _name text;
begin
  select coalesce(p.full_name, p.email, 'Alguém')
    into _name
    from public.profiles p
   where p.id = NEW.follower_id;

  insert into public.notifications (user_id, type, title, body, link, actor_id)
  values (
    NEW.following_id,
    'new_follower',
    'Novo seguidor',
    coalesce(_name, 'Alguém') || ' começou a te seguir',
    '/perfil/' || NEW.follower_id,
    NEW.follower_id
  );

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  _name text;
begin
  select coalesce(p.full_name, p.email, 'Alguém')
    into _name
    from public.profiles p
   where p.id = NEW.sender_id;

  insert into public.notifications (user_id, type, title, body, link, actor_id)
  values (
    NEW.receiver_id,
    'new_message',
    'Nova mensagem',
    coalesce(_name, 'Alguém') || ': ' || left(NEW.content, 60),
    '/mensagens/' || NEW.sender_id,
    NEW.sender_id
  );

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_prayer_support()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  _owner_id uuid;
  _name     text;
begin
  -- find the prayer request owner
  select pr.user_id
    into _owner_id
    from public.prayer_requests pr
   where pr.id = NEW.prayer_request_id;

  -- don't notify if supporter is the owner
  if _owner_id is null or _owner_id = NEW.user_id then
    return NEW;
  end if;

  select coalesce(p.full_name, p.email, 'Alguém')
    into _name
    from public.profiles p
   where p.id = NEW.user_id;

  insert into public.notifications (user_id, type, title, body, link, actor_id)
  values (
    _owner_id,
    'prayer_support',
    'Alguém orou por você',
    coalesce(_name, 'Alguém') || ' está orando pelo seu pedido',
    '/dashboard/membro/oracao',
    NEW.user_id
  );

  return NEW;
end;
$function$
;

create or replace view "public"."public_churches" as  SELECT id,
    city,
    state,
    country,
    location_type,
    meeting_days,
    meeting_time,
    description,
    created_at
   FROM public.churches
  WHERE (status = 'approved'::public.church_status);


CREATE OR REPLACE FUNCTION public.update_church_location()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.lat is not null and new.lng is not null then
    new.location := st_point(new.lng, new.lat)::geography;
  end if;
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

create type "public"."valid_detail" as ("valid" boolean, "reason" character varying, "location" public.geometry);

grant delete on table "public"."anuncios" to "anon";

grant insert on table "public"."anuncios" to "anon";

grant references on table "public"."anuncios" to "anon";

grant select on table "public"."anuncios" to "anon";

grant trigger on table "public"."anuncios" to "anon";

grant truncate on table "public"."anuncios" to "anon";

grant update on table "public"."anuncios" to "anon";

grant delete on table "public"."anuncios" to "authenticated";

grant insert on table "public"."anuncios" to "authenticated";

grant references on table "public"."anuncios" to "authenticated";

grant select on table "public"."anuncios" to "authenticated";

grant trigger on table "public"."anuncios" to "authenticated";

grant truncate on table "public"."anuncios" to "authenticated";

grant update on table "public"."anuncios" to "authenticated";

grant delete on table "public"."anuncios" to "service_role";

grant insert on table "public"."anuncios" to "service_role";

grant references on table "public"."anuncios" to "service_role";

grant select on table "public"."anuncios" to "service_role";

grant trigger on table "public"."anuncios" to "service_role";

grant truncate on table "public"."anuncios" to "service_role";

grant update on table "public"."anuncios" to "service_role";

grant delete on table "public"."banners" to "anon";

grant insert on table "public"."banners" to "anon";

grant references on table "public"."banners" to "anon";

grant select on table "public"."banners" to "anon";

grant trigger on table "public"."banners" to "anon";

grant truncate on table "public"."banners" to "anon";

grant update on table "public"."banners" to "anon";

grant delete on table "public"."banners" to "authenticated";

grant insert on table "public"."banners" to "authenticated";

grant references on table "public"."banners" to "authenticated";

grant select on table "public"."banners" to "authenticated";

grant trigger on table "public"."banners" to "authenticated";

grant truncate on table "public"."banners" to "authenticated";

grant update on table "public"."banners" to "authenticated";

grant delete on table "public"."banners" to "service_role";

grant insert on table "public"."banners" to "service_role";

grant references on table "public"."banners" to "service_role";

grant select on table "public"."banners" to "service_role";

grant trigger on table "public"."banners" to "service_role";

grant truncate on table "public"."banners" to "service_role";

grant update on table "public"."banners" to "service_role";

grant delete on table "public"."blog_posts" to "anon";

grant insert on table "public"."blog_posts" to "anon";

grant references on table "public"."blog_posts" to "anon";

grant select on table "public"."blog_posts" to "anon";

grant trigger on table "public"."blog_posts" to "anon";

grant truncate on table "public"."blog_posts" to "anon";

grant update on table "public"."blog_posts" to "anon";

grant delete on table "public"."blog_posts" to "authenticated";

grant insert on table "public"."blog_posts" to "authenticated";

grant references on table "public"."blog_posts" to "authenticated";

grant select on table "public"."blog_posts" to "authenticated";

grant trigger on table "public"."blog_posts" to "authenticated";

grant truncate on table "public"."blog_posts" to "authenticated";

grant update on table "public"."blog_posts" to "authenticated";

grant delete on table "public"."blog_posts" to "service_role";

grant insert on table "public"."blog_posts" to "service_role";

grant references on table "public"."blog_posts" to "service_role";

grant select on table "public"."blog_posts" to "service_role";

grant trigger on table "public"."blog_posts" to "service_role";

grant truncate on table "public"."blog_posts" to "service_role";

grant update on table "public"."blog_posts" to "service_role";

grant delete on table "public"."church_reviews" to "anon";

grant insert on table "public"."church_reviews" to "anon";

grant references on table "public"."church_reviews" to "anon";

grant select on table "public"."church_reviews" to "anon";

grant trigger on table "public"."church_reviews" to "anon";

grant truncate on table "public"."church_reviews" to "anon";

grant update on table "public"."church_reviews" to "anon";

grant delete on table "public"."church_reviews" to "authenticated";

grant insert on table "public"."church_reviews" to "authenticated";

grant references on table "public"."church_reviews" to "authenticated";

grant select on table "public"."church_reviews" to "authenticated";

grant trigger on table "public"."church_reviews" to "authenticated";

grant truncate on table "public"."church_reviews" to "authenticated";

grant update on table "public"."church_reviews" to "authenticated";

grant delete on table "public"."church_reviews" to "service_role";

grant insert on table "public"."church_reviews" to "service_role";

grant references on table "public"."church_reviews" to "service_role";

grant select on table "public"."church_reviews" to "service_role";

grant trigger on table "public"."church_reviews" to "service_role";

grant truncate on table "public"."church_reviews" to "service_role";

grant update on table "public"."church_reviews" to "service_role";

grant delete on table "public"."community_groups" to "anon";

grant insert on table "public"."community_groups" to "anon";

grant references on table "public"."community_groups" to "anon";

grant select on table "public"."community_groups" to "anon";

grant trigger on table "public"."community_groups" to "anon";

grant truncate on table "public"."community_groups" to "anon";

grant update on table "public"."community_groups" to "anon";

grant delete on table "public"."community_groups" to "authenticated";

grant insert on table "public"."community_groups" to "authenticated";

grant references on table "public"."community_groups" to "authenticated";

grant select on table "public"."community_groups" to "authenticated";

grant trigger on table "public"."community_groups" to "authenticated";

grant truncate on table "public"."community_groups" to "authenticated";

grant update on table "public"."community_groups" to "authenticated";

grant delete on table "public"."community_groups" to "service_role";

grant insert on table "public"."community_groups" to "service_role";

grant references on table "public"."community_groups" to "service_role";

grant select on table "public"."community_groups" to "service_role";

grant trigger on table "public"."community_groups" to "service_role";

grant truncate on table "public"."community_groups" to "service_role";

grant update on table "public"."community_groups" to "service_role";

grant delete on table "public"."content" to "anon";

grant insert on table "public"."content" to "anon";

grant references on table "public"."content" to "anon";

grant select on table "public"."content" to "anon";

grant trigger on table "public"."content" to "anon";

grant truncate on table "public"."content" to "anon";

grant update on table "public"."content" to "anon";

grant delete on table "public"."content" to "authenticated";

grant insert on table "public"."content" to "authenticated";

grant references on table "public"."content" to "authenticated";

grant select on table "public"."content" to "authenticated";

grant trigger on table "public"."content" to "authenticated";

grant truncate on table "public"."content" to "authenticated";

grant update on table "public"."content" to "authenticated";

grant delete on table "public"."content" to "service_role";

grant insert on table "public"."content" to "service_role";

grant references on table "public"."content" to "service_role";

grant select on table "public"."content" to "service_role";

grant trigger on table "public"."content" to "service_role";

grant truncate on table "public"."content" to "service_role";

grant update on table "public"."content" to "service_role";

grant delete on table "public"."content_progress" to "anon";

grant insert on table "public"."content_progress" to "anon";

grant references on table "public"."content_progress" to "anon";

grant select on table "public"."content_progress" to "anon";

grant trigger on table "public"."content_progress" to "anon";

grant truncate on table "public"."content_progress" to "anon";

grant update on table "public"."content_progress" to "anon";

grant delete on table "public"."content_progress" to "authenticated";

grant insert on table "public"."content_progress" to "authenticated";

grant references on table "public"."content_progress" to "authenticated";

grant select on table "public"."content_progress" to "authenticated";

grant trigger on table "public"."content_progress" to "authenticated";

grant truncate on table "public"."content_progress" to "authenticated";

grant update on table "public"."content_progress" to "authenticated";

grant delete on table "public"."content_progress" to "service_role";

grant insert on table "public"."content_progress" to "service_role";

grant references on table "public"."content_progress" to "service_role";

grant select on table "public"."content_progress" to "service_role";

grant trigger on table "public"."content_progress" to "service_role";

grant truncate on table "public"."content_progress" to "service_role";

grant update on table "public"."content_progress" to "service_role";

grant delete on table "public"."convites" to "anon";

grant insert on table "public"."convites" to "anon";

grant references on table "public"."convites" to "anon";

grant select on table "public"."convites" to "anon";

grant trigger on table "public"."convites" to "anon";

grant truncate on table "public"."convites" to "anon";

grant update on table "public"."convites" to "anon";

grant delete on table "public"."convites" to "authenticated";

grant insert on table "public"."convites" to "authenticated";

grant references on table "public"."convites" to "authenticated";

grant select on table "public"."convites" to "authenticated";

grant trigger on table "public"."convites" to "authenticated";

grant truncate on table "public"."convites" to "authenticated";

grant update on table "public"."convites" to "authenticated";

grant delete on table "public"."convites" to "service_role";

grant insert on table "public"."convites" to "service_role";

grant references on table "public"."convites" to "service_role";

grant select on table "public"."convites" to "service_role";

grant trigger on table "public"."convites" to "service_role";

grant truncate on table "public"."convites" to "service_role";

grant update on table "public"."convites" to "service_role";

grant delete on table "public"."direct_messages" to "anon";

grant insert on table "public"."direct_messages" to "anon";

grant references on table "public"."direct_messages" to "anon";

grant select on table "public"."direct_messages" to "anon";

grant trigger on table "public"."direct_messages" to "anon";

grant truncate on table "public"."direct_messages" to "anon";

grant update on table "public"."direct_messages" to "anon";

grant delete on table "public"."direct_messages" to "authenticated";

grant insert on table "public"."direct_messages" to "authenticated";

grant references on table "public"."direct_messages" to "authenticated";

grant select on table "public"."direct_messages" to "authenticated";

grant trigger on table "public"."direct_messages" to "authenticated";

grant truncate on table "public"."direct_messages" to "authenticated";

grant update on table "public"."direct_messages" to "authenticated";

grant delete on table "public"."direct_messages" to "service_role";

grant insert on table "public"."direct_messages" to "service_role";

grant references on table "public"."direct_messages" to "service_role";

grant select on table "public"."direct_messages" to "service_role";

grant trigger on table "public"."direct_messages" to "service_role";

grant truncate on table "public"."direct_messages" to "service_role";

grant update on table "public"."direct_messages" to "service_role";

grant delete on table "public"."favorites" to "anon";

grant insert on table "public"."favorites" to "anon";

grant references on table "public"."favorites" to "anon";

grant select on table "public"."favorites" to "anon";

grant trigger on table "public"."favorites" to "anon";

grant truncate on table "public"."favorites" to "anon";

grant update on table "public"."favorites" to "anon";

grant delete on table "public"."favorites" to "authenticated";

grant insert on table "public"."favorites" to "authenticated";

grant references on table "public"."favorites" to "authenticated";

grant select on table "public"."favorites" to "authenticated";

grant trigger on table "public"."favorites" to "authenticated";

grant truncate on table "public"."favorites" to "authenticated";

grant update on table "public"."favorites" to "authenticated";

grant delete on table "public"."favorites" to "service_role";

grant insert on table "public"."favorites" to "service_role";

grant references on table "public"."favorites" to "service_role";

grant select on table "public"."favorites" to "service_role";

grant trigger on table "public"."favorites" to "service_role";

grant truncate on table "public"."favorites" to "service_role";

grant update on table "public"."favorites" to "service_role";

grant delete on table "public"."follows" to "anon";

grant insert on table "public"."follows" to "anon";

grant references on table "public"."follows" to "anon";

grant select on table "public"."follows" to "anon";

grant trigger on table "public"."follows" to "anon";

grant truncate on table "public"."follows" to "anon";

grant update on table "public"."follows" to "anon";

grant delete on table "public"."follows" to "authenticated";

grant insert on table "public"."follows" to "authenticated";

grant references on table "public"."follows" to "authenticated";

grant select on table "public"."follows" to "authenticated";

grant trigger on table "public"."follows" to "authenticated";

grant truncate on table "public"."follows" to "authenticated";

grant update on table "public"."follows" to "authenticated";

grant delete on table "public"."follows" to "service_role";

grant insert on table "public"."follows" to "service_role";

grant references on table "public"."follows" to "service_role";

grant select on table "public"."follows" to "service_role";

grant trigger on table "public"."follows" to "service_role";

grant truncate on table "public"."follows" to "service_role";

grant update on table "public"."follows" to "service_role";

grant delete on table "public"."group_members" to "anon";

grant insert on table "public"."group_members" to "anon";

grant references on table "public"."group_members" to "anon";

grant select on table "public"."group_members" to "anon";

grant trigger on table "public"."group_members" to "anon";

grant truncate on table "public"."group_members" to "anon";

grant update on table "public"."group_members" to "anon";

grant delete on table "public"."group_members" to "authenticated";

grant insert on table "public"."group_members" to "authenticated";

grant references on table "public"."group_members" to "authenticated";

grant select on table "public"."group_members" to "authenticated";

grant trigger on table "public"."group_members" to "authenticated";

grant truncate on table "public"."group_members" to "authenticated";

grant update on table "public"."group_members" to "authenticated";

grant delete on table "public"."group_members" to "service_role";

grant insert on table "public"."group_members" to "service_role";

grant references on table "public"."group_members" to "service_role";

grant select on table "public"."group_members" to "service_role";

grant trigger on table "public"."group_members" to "service_role";

grant truncate on table "public"."group_members" to "service_role";

grant update on table "public"."group_members" to "service_role";

grant delete on table "public"."group_messages" to "anon";

grant insert on table "public"."group_messages" to "anon";

grant references on table "public"."group_messages" to "anon";

grant select on table "public"."group_messages" to "anon";

grant trigger on table "public"."group_messages" to "anon";

grant truncate on table "public"."group_messages" to "anon";

grant update on table "public"."group_messages" to "anon";

grant delete on table "public"."group_messages" to "authenticated";

grant insert on table "public"."group_messages" to "authenticated";

grant references on table "public"."group_messages" to "authenticated";

grant select on table "public"."group_messages" to "authenticated";

grant trigger on table "public"."group_messages" to "authenticated";

grant truncate on table "public"."group_messages" to "authenticated";

grant update on table "public"."group_messages" to "authenticated";

grant delete on table "public"."group_messages" to "service_role";

grant insert on table "public"."group_messages" to "service_role";

grant references on table "public"."group_messages" to "service_role";

grant select on table "public"."group_messages" to "service_role";

grant trigger on table "public"."group_messages" to "service_role";

grant truncate on table "public"."group_messages" to "service_role";

grant update on table "public"."group_messages" to "service_role";

grant delete on table "public"."igrejas_home" to "anon";

grant insert on table "public"."igrejas_home" to "anon";

grant references on table "public"."igrejas_home" to "anon";

grant select on table "public"."igrejas_home" to "anon";

grant trigger on table "public"."igrejas_home" to "anon";

grant truncate on table "public"."igrejas_home" to "anon";

grant update on table "public"."igrejas_home" to "anon";

grant delete on table "public"."igrejas_home" to "authenticated";

grant insert on table "public"."igrejas_home" to "authenticated";

grant references on table "public"."igrejas_home" to "authenticated";

grant select on table "public"."igrejas_home" to "authenticated";

grant trigger on table "public"."igrejas_home" to "authenticated";

grant truncate on table "public"."igrejas_home" to "authenticated";

grant update on table "public"."igrejas_home" to "authenticated";

grant delete on table "public"."igrejas_home" to "service_role";

grant insert on table "public"."igrejas_home" to "service_role";

grant references on table "public"."igrejas_home" to "service_role";

grant select on table "public"."igrejas_home" to "service_role";

grant trigger on table "public"."igrejas_home" to "service_role";

grant truncate on table "public"."igrejas_home" to "service_role";

grant update on table "public"."igrejas_home" to "service_role";

grant delete on table "public"."membros_pendentes" to "anon";

grant insert on table "public"."membros_pendentes" to "anon";

grant references on table "public"."membros_pendentes" to "anon";

grant select on table "public"."membros_pendentes" to "anon";

grant trigger on table "public"."membros_pendentes" to "anon";

grant truncate on table "public"."membros_pendentes" to "anon";

grant update on table "public"."membros_pendentes" to "anon";

grant delete on table "public"."membros_pendentes" to "authenticated";

grant insert on table "public"."membros_pendentes" to "authenticated";

grant references on table "public"."membros_pendentes" to "authenticated";

grant select on table "public"."membros_pendentes" to "authenticated";

grant trigger on table "public"."membros_pendentes" to "authenticated";

grant truncate on table "public"."membros_pendentes" to "authenticated";

grant update on table "public"."membros_pendentes" to "authenticated";

grant delete on table "public"."membros_pendentes" to "service_role";

grant insert on table "public"."membros_pendentes" to "service_role";

grant references on table "public"."membros_pendentes" to "service_role";

grant select on table "public"."membros_pendentes" to "service_role";

grant trigger on table "public"."membros_pendentes" to "service_role";

grant truncate on table "public"."membros_pendentes" to "service_role";

grant update on table "public"."membros_pendentes" to "service_role";

grant delete on table "public"."ministerio_membros" to "anon";

grant insert on table "public"."ministerio_membros" to "anon";

grant references on table "public"."ministerio_membros" to "anon";

grant select on table "public"."ministerio_membros" to "anon";

grant trigger on table "public"."ministerio_membros" to "anon";

grant truncate on table "public"."ministerio_membros" to "anon";

grant update on table "public"."ministerio_membros" to "anon";

grant delete on table "public"."ministerio_membros" to "authenticated";

grant insert on table "public"."ministerio_membros" to "authenticated";

grant references on table "public"."ministerio_membros" to "authenticated";

grant select on table "public"."ministerio_membros" to "authenticated";

grant trigger on table "public"."ministerio_membros" to "authenticated";

grant truncate on table "public"."ministerio_membros" to "authenticated";

grant update on table "public"."ministerio_membros" to "authenticated";

grant delete on table "public"."ministerio_membros" to "service_role";

grant insert on table "public"."ministerio_membros" to "service_role";

grant references on table "public"."ministerio_membros" to "service_role";

grant select on table "public"."ministerio_membros" to "service_role";

grant trigger on table "public"."ministerio_membros" to "service_role";

grant truncate on table "public"."ministerio_membros" to "service_role";

grant update on table "public"."ministerio_membros" to "service_role";

grant delete on table "public"."ministerios" to "anon";

grant insert on table "public"."ministerios" to "anon";

grant references on table "public"."ministerios" to "anon";

grant select on table "public"."ministerios" to "anon";

grant trigger on table "public"."ministerios" to "anon";

grant truncate on table "public"."ministerios" to "anon";

grant update on table "public"."ministerios" to "anon";

grant delete on table "public"."ministerios" to "authenticated";

grant insert on table "public"."ministerios" to "authenticated";

grant references on table "public"."ministerios" to "authenticated";

grant select on table "public"."ministerios" to "authenticated";

grant trigger on table "public"."ministerios" to "authenticated";

grant truncate on table "public"."ministerios" to "authenticated";

grant update on table "public"."ministerios" to "authenticated";

grant delete on table "public"."ministerios" to "service_role";

grant insert on table "public"."ministerios" to "service_role";

grant references on table "public"."ministerios" to "service_role";

grant select on table "public"."ministerios" to "service_role";

grant trigger on table "public"."ministerios" to "service_role";

grant truncate on table "public"."ministerios" to "service_role";

grant update on table "public"."ministerios" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."prayer_requests" to "anon";

grant insert on table "public"."prayer_requests" to "anon";

grant references on table "public"."prayer_requests" to "anon";

grant select on table "public"."prayer_requests" to "anon";

grant trigger on table "public"."prayer_requests" to "anon";

grant truncate on table "public"."prayer_requests" to "anon";

grant update on table "public"."prayer_requests" to "anon";

grant delete on table "public"."prayer_requests" to "authenticated";

grant insert on table "public"."prayer_requests" to "authenticated";

grant references on table "public"."prayer_requests" to "authenticated";

grant select on table "public"."prayer_requests" to "authenticated";

grant trigger on table "public"."prayer_requests" to "authenticated";

grant truncate on table "public"."prayer_requests" to "authenticated";

grant update on table "public"."prayer_requests" to "authenticated";

grant delete on table "public"."prayer_requests" to "service_role";

grant insert on table "public"."prayer_requests" to "service_role";

grant references on table "public"."prayer_requests" to "service_role";

grant select on table "public"."prayer_requests" to "service_role";

grant trigger on table "public"."prayer_requests" to "service_role";

grant truncate on table "public"."prayer_requests" to "service_role";

grant update on table "public"."prayer_requests" to "service_role";

grant delete on table "public"."prayer_supports" to "anon";

grant insert on table "public"."prayer_supports" to "anon";

grant references on table "public"."prayer_supports" to "anon";

grant select on table "public"."prayer_supports" to "anon";

grant trigger on table "public"."prayer_supports" to "anon";

grant truncate on table "public"."prayer_supports" to "anon";

grant update on table "public"."prayer_supports" to "anon";

grant delete on table "public"."prayer_supports" to "authenticated";

grant insert on table "public"."prayer_supports" to "authenticated";

grant references on table "public"."prayer_supports" to "authenticated";

grant select on table "public"."prayer_supports" to "authenticated";

grant trigger on table "public"."prayer_supports" to "authenticated";

grant truncate on table "public"."prayer_supports" to "authenticated";

grant update on table "public"."prayer_supports" to "authenticated";

grant delete on table "public"."prayer_supports" to "service_role";

grant insert on table "public"."prayer_supports" to "service_role";

grant references on table "public"."prayer_supports" to "service_role";

grant select on table "public"."prayer_supports" to "service_role";

grant trigger on table "public"."prayer_supports" to "service_role";

grant truncate on table "public"."prayer_supports" to "service_role";

grant update on table "public"."prayer_supports" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."recursos" to "anon";

grant insert on table "public"."recursos" to "anon";

grant references on table "public"."recursos" to "anon";

grant select on table "public"."recursos" to "anon";

grant trigger on table "public"."recursos" to "anon";

grant truncate on table "public"."recursos" to "anon";

grant update on table "public"."recursos" to "anon";

grant delete on table "public"."recursos" to "authenticated";

grant insert on table "public"."recursos" to "authenticated";

grant references on table "public"."recursos" to "authenticated";

grant select on table "public"."recursos" to "authenticated";

grant trigger on table "public"."recursos" to "authenticated";

grant truncate on table "public"."recursos" to "authenticated";

grant update on table "public"."recursos" to "authenticated";

grant delete on table "public"."recursos" to "service_role";

grant insert on table "public"."recursos" to "service_role";

grant references on table "public"."recursos" to "service_role";

grant select on table "public"."recursos" to "service_role";

grant trigger on table "public"."recursos" to "service_role";

grant truncate on table "public"."recursos" to "service_role";

grant update on table "public"."recursos" to "service_role";

grant delete on table "public"."reuniao_attendance" to "anon";

grant insert on table "public"."reuniao_attendance" to "anon";

grant references on table "public"."reuniao_attendance" to "anon";

grant select on table "public"."reuniao_attendance" to "anon";

grant trigger on table "public"."reuniao_attendance" to "anon";

grant truncate on table "public"."reuniao_attendance" to "anon";

grant update on table "public"."reuniao_attendance" to "anon";

grant delete on table "public"."reuniao_attendance" to "authenticated";

grant insert on table "public"."reuniao_attendance" to "authenticated";

grant references on table "public"."reuniao_attendance" to "authenticated";

grant select on table "public"."reuniao_attendance" to "authenticated";

grant trigger on table "public"."reuniao_attendance" to "authenticated";

grant truncate on table "public"."reuniao_attendance" to "authenticated";

grant update on table "public"."reuniao_attendance" to "authenticated";

grant delete on table "public"."reuniao_attendance" to "service_role";

grant insert on table "public"."reuniao_attendance" to "service_role";

grant references on table "public"."reuniao_attendance" to "service_role";

grant select on table "public"."reuniao_attendance" to "service_role";

grant trigger on table "public"."reuniao_attendance" to "service_role";

grant truncate on table "public"."reuniao_attendance" to "service_role";

grant update on table "public"."reuniao_attendance" to "service_role";

grant delete on table "public"."reunioes" to "anon";

grant insert on table "public"."reunioes" to "anon";

grant references on table "public"."reunioes" to "anon";

grant select on table "public"."reunioes" to "anon";

grant trigger on table "public"."reunioes" to "anon";

grant truncate on table "public"."reunioes" to "anon";

grant update on table "public"."reunioes" to "anon";

grant delete on table "public"."reunioes" to "authenticated";

grant insert on table "public"."reunioes" to "authenticated";

grant references on table "public"."reunioes" to "authenticated";

grant select on table "public"."reunioes" to "authenticated";

grant trigger on table "public"."reunioes" to "authenticated";

grant truncate on table "public"."reunioes" to "authenticated";

grant update on table "public"."reunioes" to "authenticated";

grant delete on table "public"."reunioes" to "service_role";

grant insert on table "public"."reunioes" to "service_role";

grant references on table "public"."reunioes" to "service_role";

grant select on table "public"."reunioes" to "service_role";

grant trigger on table "public"."reunioes" to "service_role";

grant truncate on table "public"."reunioes" to "service_role";

grant update on table "public"."reunioes" to "service_role";

grant delete on table "public"."settings" to "anon";

grant insert on table "public"."settings" to "anon";

grant references on table "public"."settings" to "anon";

grant select on table "public"."settings" to "anon";

grant trigger on table "public"."settings" to "anon";

grant truncate on table "public"."settings" to "anon";

grant update on table "public"."settings" to "anon";

grant delete on table "public"."settings" to "authenticated";

grant insert on table "public"."settings" to "authenticated";

grant references on table "public"."settings" to "authenticated";

grant select on table "public"."settings" to "authenticated";

grant trigger on table "public"."settings" to "authenticated";

grant truncate on table "public"."settings" to "authenticated";

grant update on table "public"."settings" to "authenticated";

grant delete on table "public"."settings" to "service_role";

grant insert on table "public"."settings" to "service_role";

grant references on table "public"."settings" to "service_role";

grant select on table "public"."settings" to "service_role";

grant trigger on table "public"."settings" to "service_role";

grant truncate on table "public"."settings" to "service_role";

grant update on table "public"."settings" to "service_role";

grant delete on table "public"."spatial_ref_sys" to "anon";

grant insert on table "public"."spatial_ref_sys" to "anon";

grant references on table "public"."spatial_ref_sys" to "anon";

grant select on table "public"."spatial_ref_sys" to "anon";

grant trigger on table "public"."spatial_ref_sys" to "anon";

grant truncate on table "public"."spatial_ref_sys" to "anon";

grant update on table "public"."spatial_ref_sys" to "anon";

grant delete on table "public"."spatial_ref_sys" to "authenticated";

grant insert on table "public"."spatial_ref_sys" to "authenticated";

grant references on table "public"."spatial_ref_sys" to "authenticated";

grant select on table "public"."spatial_ref_sys" to "authenticated";

grant trigger on table "public"."spatial_ref_sys" to "authenticated";

grant truncate on table "public"."spatial_ref_sys" to "authenticated";

grant update on table "public"."spatial_ref_sys" to "authenticated";

grant delete on table "public"."spatial_ref_sys" to "postgres";

grant insert on table "public"."spatial_ref_sys" to "postgres";

grant references on table "public"."spatial_ref_sys" to "postgres";

grant select on table "public"."spatial_ref_sys" to "postgres";

grant trigger on table "public"."spatial_ref_sys" to "postgres";

grant truncate on table "public"."spatial_ref_sys" to "postgres";

grant update on table "public"."spatial_ref_sys" to "postgres";

grant delete on table "public"."spatial_ref_sys" to "service_role";

grant insert on table "public"."spatial_ref_sys" to "service_role";

grant references on table "public"."spatial_ref_sys" to "service_role";

grant select on table "public"."spatial_ref_sys" to "service_role";

grant trigger on table "public"."spatial_ref_sys" to "service_role";

grant truncate on table "public"."spatial_ref_sys" to "service_role";

grant update on table "public"."spatial_ref_sys" to "service_role";

grant delete on table "public"."testimonials" to "anon";

grant insert on table "public"."testimonials" to "anon";

grant references on table "public"."testimonials" to "anon";

grant select on table "public"."testimonials" to "anon";

grant trigger on table "public"."testimonials" to "anon";

grant truncate on table "public"."testimonials" to "anon";

grant update on table "public"."testimonials" to "anon";

grant delete on table "public"."testimonials" to "authenticated";

grant insert on table "public"."testimonials" to "authenticated";

grant references on table "public"."testimonials" to "authenticated";

grant select on table "public"."testimonials" to "authenticated";

grant trigger on table "public"."testimonials" to "authenticated";

grant truncate on table "public"."testimonials" to "authenticated";

grant update on table "public"."testimonials" to "authenticated";

grant delete on table "public"."testimonials" to "service_role";

grant insert on table "public"."testimonials" to "service_role";

grant references on table "public"."testimonials" to "service_role";

grant select on table "public"."testimonials" to "service_role";

grant trigger on table "public"."testimonials" to "service_role";

grant truncate on table "public"."testimonials" to "service_role";

grant update on table "public"."testimonials" to "service_role";


  create policy "anuncios: lideres can create announcements"
  on "public"."anuncios"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.igrejas_home
  WHERE ((igrejas_home.id = anuncios.igreja_home_id) AND (igrejas_home.lider_id = auth.uid())))));



  create policy "anuncios: lideres can delete their announcements"
  on "public"."anuncios"
  as permissive
  for delete
  to authenticated
using ((criado_por = auth.uid()));



  create policy "anuncios: lideres can update their announcements"
  on "public"."anuncios"
  as permissive
  for update
  to authenticated
using ((criado_por = auth.uid()));



  create policy "anuncios: members can view their church announcements"
  on "public"."anuncios"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.igreja_home_id = anuncios.igreja_home_id)))) OR (EXISTS ( SELECT 1
   FROM public.igrejas_home
  WHERE ((igrejas_home.id = anuncios.igreja_home_id) AND (igrejas_home.lider_id = auth.uid()))))));



  create policy "Admin can manage banners"
  on "public"."banners"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "banners_select_active"
  on "public"."banners"
  as permissive
  for select
  to public
using ((active = true));



  create policy "Admin can manage posts"
  on "public"."blog_posts"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "blog_select_published"
  on "public"."blog_posts"
  as permissive
  for select
  to public
using ((published = true));



  create policy "church_reviews: anyone can read"
  on "public"."church_reviews"
  as permissive
  for select
  to public
using (true);



  create policy "church_reviews: authenticated can insert"
  on "public"."church_reviews"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "church_reviews: owner can delete"
  on "public"."church_reviews"
  as permissive
  for delete
  to authenticated
using ((user_id = auth.uid()));



  create policy "church_reviews: owner can update"
  on "public"."church_reviews"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "churches_anon_select"
  on "public"."churches"
  as permissive
  for select
  to anon
using ((status = 'approved'::public.church_status));



  create policy "churches_auth_select"
  on "public"."churches"
  as permissive
  for select
  to authenticated
using (((status = 'approved'::public.church_status) OR (user_id = auth.uid()) OR public.is_admin()));



  create policy "community_groups: authenticated users can create groups"
  on "public"."community_groups"
  as permissive
  for insert
  to authenticated
with check ((created_by = auth.uid()));



  create policy "community_groups: authenticated users can view public groups"
  on "public"."community_groups"
  as permissive
  for select
  to authenticated
using ((is_public = true));



  create policy "community_groups: creator can delete their group"
  on "public"."community_groups"
  as permissive
  for delete
  to authenticated
using ((created_by = auth.uid()));



  create policy "community_groups: creator can update their group"
  on "public"."community_groups"
  as permissive
  for update
  to authenticated
using ((created_by = auth.uid()))
with check ((created_by = auth.uid()));



  create policy "community_groups: members can view their private groups"
  on "public"."community_groups"
  as permissive
  for select
  to authenticated
using (((is_public = false) AND public.is_group_member(id, auth.uid())));



  create policy "Admin can manage content"
  on "public"."content"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "content_select_published"
  on "public"."content"
  as permissive
  for select
  to public
using ((published = true));



  create policy "content_progress_delete_own"
  on "public"."content_progress"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "content_progress_insert_own"
  on "public"."content_progress"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "content_progress_select_own"
  on "public"."content_progress"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "content_progress_update_own"
  on "public"."content_progress"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "convites_insert_lider"
  on "public"."convites"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lider'::public.user_role, 'admin'::public.user_role]))))));



  create policy "convites_select_by_token"
  on "public"."convites"
  as permissive
  for select
  to public
using (((usado = false) AND (expira_em > now())));



  create policy "convites_select_lider"
  on "public"."convites"
  as permissive
  for select
  to public
using (((criado_por = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.igrejas_home ih
  WHERE ((ih.id = convites.igreja_home_id) AND (ih.lider_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));



  create policy "convites_update_admin"
  on "public"."convites"
  as permissive
  for update
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))) OR (criado_por = auth.uid())));



  create policy "direct_messages: authenticated users can send messages"
  on "public"."direct_messages"
  as permissive
  for insert
  to authenticated
with check ((sender_id = auth.uid()));



  create policy "direct_messages: participants can read their messages"
  on "public"."direct_messages"
  as permissive
  for select
  to authenticated
using (((deleted_at IS NULL) AND ((sender_id = auth.uid()) OR (receiver_id = auth.uid()))));



  create policy "direct_messages: sender can soft-delete own message"
  on "public"."direct_messages"
  as permissive
  for update
  to authenticated
using ((sender_id = auth.uid()))
with check ((sender_id = auth.uid()));



  create policy "favorites_delete_own"
  on "public"."favorites"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "favorites_insert_own"
  on "public"."favorites"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "favorites_select_own"
  on "public"."favorites"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Authenticated can view follows"
  on "public"."follows"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Users can follow others"
  on "public"."follows"
  as permissive
  for insert
  to public
with check ((auth.uid() = follower_id));



  create policy "Users can unfollow"
  on "public"."follows"
  as permissive
  for delete
  to public
using ((auth.uid() = follower_id));



  create policy "group_members: authenticated users can join public groups"
  on "public"."group_members"
  as permissive
  for insert
  to authenticated
with check (((user_id = auth.uid()) AND (role = 'member'::text) AND (EXISTS ( SELECT 1
   FROM public.community_groups
  WHERE ((community_groups.id = group_members.group_id) AND (community_groups.is_public = true))))));



  create policy "group_members: members can leave a group"
  on "public"."group_members"
  as permissive
  for delete
  to authenticated
using ((user_id = auth.uid()));



  create policy "group_members: members can view members of their groups"
  on "public"."group_members"
  as permissive
  for select
  to authenticated
using (public.is_group_member(group_id, auth.uid()));



  create policy "group_members: owners and admins can add members"
  on "public"."group_members"
  as permissive
  for insert
  to authenticated
with check (public.is_group_owner_or_admin(group_id, auth.uid()));



  create policy "group_members: owners and admins can remove members"
  on "public"."group_members"
  as permissive
  for delete
  to authenticated
using (public.is_group_owner_or_admin(group_id, auth.uid()));



  create policy "group_messages: members can read messages"
  on "public"."group_messages"
  as permissive
  for select
  to authenticated
using (((deleted_at IS NULL) AND public.is_group_member(group_id, auth.uid())));



  create policy "group_messages: members can send messages"
  on "public"."group_messages"
  as permissive
  for insert
  to authenticated
with check (((sender_id = auth.uid()) AND public.is_group_member(group_id, auth.uid())));



  create policy "group_messages: owners and admins can soft-delete any message"
  on "public"."group_messages"
  as permissive
  for update
  to authenticated
using (public.is_group_owner_or_admin(group_id, auth.uid()));



  create policy "group_messages: sender can soft-delete own message"
  on "public"."group_messages"
  as permissive
  for update
  to authenticated
using ((sender_id = auth.uid()))
with check ((sender_id = auth.uid()));



  create policy "igrejas_home_delete_admin"
  on "public"."igrejas_home"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));



  create policy "igrejas_home_insert_admin"
  on "public"."igrejas_home"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));



  create policy "igrejas_home_select_admin"
  on "public"."igrejas_home"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));



  create policy "igrejas_home_select_member"
  on "public"."igrejas_home"
  as permissive
  for select
  to public
using (((id IN ( SELECT profiles.igreja_home_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (lider_id = auth.uid())));



  create policy "igrejas_home_update_lider_admin"
  on "public"."igrejas_home"
  as permissive
  for update
  to public
using (((lider_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));



  create policy "membros_pendentes_insert"
  on "public"."membros_pendentes"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "membros_pendentes_select_lider"
  on "public"."membros_pendentes"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.igrejas_home ih
  WHERE ((ih.id = membros_pendentes.igreja_home_id) AND ((ih.lider_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))))))));



  create policy "membros_pendentes_select_own"
  on "public"."membros_pendentes"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "membros_pendentes_update_lider"
  on "public"."membros_pendentes"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.igrejas_home ih
  WHERE ((ih.id = membros_pendentes.igreja_home_id) AND ((ih.lider_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))))))));



  create policy "ministerio_membros: lideres can manage"
  on "public"."ministerio_membros"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.ministerios m
     JOIN public.igrejas_home ih ON ((ih.id = m.igreja_home_id)))
  WHERE ((m.id = ministerio_membros.ministerio_id) AND (ih.lider_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM (public.ministerios m
     JOIN public.igrejas_home ih ON ((ih.id = m.igreja_home_id)))
  WHERE ((m.id = ministerio_membros.ministerio_id) AND (ih.lider_id = auth.uid())))));



  create policy "ministerio_membros: members can view"
  on "public"."ministerio_membros"
  as permissive
  for select
  to authenticated
using (true);



  create policy "ministerios: lideres can manage"
  on "public"."ministerios"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.igrejas_home
  WHERE ((igrejas_home.id = ministerios.igreja_home_id) AND (igrejas_home.lider_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM public.igrejas_home
  WHERE ((igrejas_home.id = ministerios.igreja_home_id) AND (igrejas_home.lider_id = auth.uid())))));



  create policy "ministerios: members can view"
  on "public"."ministerios"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.igreja_home_id = ministerios.igreja_home_id)))) OR (EXISTS ( SELECT 1
   FROM public.igrejas_home
  WHERE ((igrejas_home.id = ministerios.igreja_home_id) AND (igrejas_home.lider_id = auth.uid()))))));



  create policy "System can insert notifications"
  on "public"."notifications"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users mark own as read"
  on "public"."notifications"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users see own notifications"
  on "public"."notifications"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "prayer_requests_delete_owner"
  on "public"."prayer_requests"
  as permissive
  for delete
  to public
using (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role))))));



  create policy "prayer_requests_insert_member"
  on "public"."prayer_requests"
  as permissive
  for insert
  to public
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.igreja_home_id = prayer_requests.church_id))))));



  create policy "prayer_requests_select_member"
  on "public"."prayer_requests"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.igreja_home_id = prayer_requests.church_id)))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role))))));



  create policy "prayer_requests_update_owner"
  on "public"."prayer_requests"
  as permissive
  for update
  to public
using (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role))))));



  create policy "prayer_supports_delete_own"
  on "public"."prayer_supports"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "prayer_supports_insert_member"
  on "public"."prayer_supports"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "prayer_supports_select_member"
  on "public"."prayer_supports"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM (public.prayer_requests pr
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((pr.id = prayer_supports.prayer_request_id) AND (p.igreja_home_id = pr.church_id)))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role))))));



  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "profiles_select_admin"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (public.is_admin());



  create policy "profiles_select_own"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((auth.uid() = id));



  create policy "profiles_select_same_church"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (((igreja_home_id IS NOT NULL) AND (igreja_home_id = public.get_my_church_id())));



  create policy "profiles_update_admin"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "recursos_delete_lider_admin"
  on "public"."recursos"
  as permissive
  for delete
  to public
using (((criado_por = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));



  create policy "recursos_insert_lider_admin"
  on "public"."recursos"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lider'::public.user_role, 'admin'::public.user_role]))))));



  create policy "recursos_select_member"
  on "public"."recursos"
  as permissive
  for select
  to public
using (((publicado = true) AND ((igreja_home_id IS NULL) OR (igreja_home_id IN ( SELECT profiles.igreja_home_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))))));



  create policy "recursos_update_lider_admin"
  on "public"."recursos"
  as permissive
  for update
  to public
using (((criado_por = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));



  create policy "reuniao_attendance: lideres can manage attendance"
  on "public"."reuniao_attendance"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM (public.reunioes r
     JOIN public.igrejas_home ih ON ((ih.id = r.igreja_home_id)))
  WHERE ((r.id = reuniao_attendance.reuniao_id) AND (ih.lider_id = auth.uid())))));



  create policy "reuniao_attendance: members can manage own rsvp"
  on "public"."reuniao_attendance"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "reuniao_attendance_delete_lider_admin"
  on "public"."reuniao_attendance"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['lider'::public.user_role, 'admin'::public.user_role]))))));



  create policy "reuniao_attendance_insert_own"
  on "public"."reuniao_attendance"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "reuniao_attendance_select_member"
  on "public"."reuniao_attendance"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM (public.reunioes r
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((r.id = reuniao_attendance.reuniao_id) AND (p.igreja_home_id = r.igreja_home_id)))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['lider'::public.user_role, 'admin'::public.user_role])))))));



  create policy "reuniao_attendance_update_own"
  on "public"."reuniao_attendance"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "reunioes_delete_lider"
  on "public"."reunioes"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.igrejas_home ih
  WHERE ((ih.id = reunioes.igreja_home_id) AND ((ih.lider_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))))))));



  create policy "reunioes_insert_lider"
  on "public"."reunioes"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.igrejas_home ih ON ((ih.id = reunioes.igreja_home_id)))
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['lider'::public.user_role, 'admin'::public.user_role])) AND ((ih.lider_id = auth.uid()) OR (p.role = 'admin'::public.user_role))))));



  create policy "reunioes_select_member"
  on "public"."reunioes"
  as permissive
  for select
  to public
using (((igreja_home_id IN ( SELECT profiles.igreja_home_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));



  create policy "reunioes_update_lider"
  on "public"."reunioes"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.igrejas_home ih
  WHERE ((ih.id = reunioes.igreja_home_id) AND ((ih.lider_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))))))));



  create policy "Admin can manage settings"
  on "public"."settings"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "Public can read settings"
  on "public"."settings"
  as permissive
  for select
  to public
using (true);



  create policy "testimonials_delete_admin"
  on "public"."testimonials"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role)))));



  create policy "testimonials_insert_own"
  on "public"."testimonials"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "testimonials_select_admin"
  on "public"."testimonials"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role)))));



  create policy "testimonials_select_approved"
  on "public"."testimonials"
  as permissive
  for select
  to public
using ((approved = true));



  create policy "testimonials_update_admin"
  on "public"."testimonials"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role)))));



  create policy "churches_insert"
  on "public"."churches"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "churches_update"
  on "public"."churches"
  as permissive
  for update
  to authenticated
using ((((auth.uid() = user_id) AND (status = 'pending'::public.church_status)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))))
with check ((((auth.uid() = user_id) AND (status = 'pending'::public.church_status)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


CREATE TRIGGER churches_slug_gen BEFORE INSERT ON public.churches FOR EACH ROW WHEN ((new.slug IS NULL)) EXECUTE FUNCTION public.generate_church_slug();

CREATE TRIGGER churches_update_location BEFORE INSERT OR UPDATE ON public.churches FOR EACH ROW EXECUTE FUNCTION public.update_church_location();

CREATE TRIGGER set_community_groups_updated_at BEFORE UPDATE ON public.community_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_notify_new_message AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

CREATE TRIGGER trg_notify_new_follower AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.notify_new_follower();

CREATE TRIGGER trg_notify_group_message AFTER INSERT ON public.group_messages FOR EACH ROW EXECUTE FUNCTION public.notify_group_message();

CREATE TRIGGER igrejas_home_updated_at BEFORE UPDATE ON public.igrejas_home FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_notify_member_approved AFTER UPDATE ON public.membros_pendentes FOR EACH ROW EXECUTE FUNCTION public.notify_member_approved();

CREATE TRIGGER prayer_requests_updated_at BEFORE UPDATE ON public.prayer_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_notify_prayer_support AFTER INSERT ON public.prayer_supports FOR EACH ROW EXECUTE FUNCTION public.notify_prayer_support();

CREATE TRIGGER reunioes_updated_at BEFORE UPDATE ON public.reunioes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


