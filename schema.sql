-- Enable RLS
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- Table: workouts
create table workouts (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  title text not null,
  description text,
  type text not null -- e.g., 'For Time', 'AMRAP', 'Strength'
);

alter table workouts enable row level security;

create policy "Public workouts are viewable by everyone."
  on workouts for select
  using ( true );

-- Table: logs
create table logs (
  id uuid default gen_random_uuid() primary key,
  workout_id uuid references workouts(id) not null,
  user_id uuid references auth.users(id) not null,
  result_score text not null, -- e.g., '10:30', '185lbs'
  video_storage_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table logs enable row level security;

create policy "Users can insert their own logs."
  on logs for insert
  with check ( auth.uid() = user_id );

create policy "Users can view their own logs."
  on logs for select
  using ( auth.uid() = user_id );

-- Table: analysis
create table analysis (
  id uuid default gen_random_uuid() primary key,
  log_id uuid references logs(id) not null,
  skeleton_data jsonb,
  coach_notes text,
  ai_feedback text
);

alter table analysis enable row level security;

create policy "Users can view analysis of their own logs."
  on analysis for select
  using ( exists ( select 1 from logs where id = analysis.log_id and user_id = auth.uid() ) );
