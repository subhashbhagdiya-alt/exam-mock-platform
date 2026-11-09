-- Persist the display-to-source option order for each secure mock-test session.
-- Existing sessions keep the identity order through the fallback in submit_mock_test.
alter table public.mock_test_sessions
  add column if not exists option_orders jsonb not null default '[]'::jsonb;

create or replace function public.create_mock_test_session(
  p_exam_id uuid,
  p_question_ids jsonb,
  p_session_key uuid,
  p_option_orders jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_count integer;
  v_valid integer;
  v_session_id uuid;
  v_order jsonb;
begin
  if p_session_key is null
    or coalesce(jsonb_typeof(p_question_ids), '') <> 'array'
    or coalesce(jsonb_typeof(p_option_orders), '') <> 'array' then
    raise exception 'Invalid mock test session payload';
  end if;

  v_count := jsonb_array_length(p_question_ids);
  if v_count < 1 or v_count > 100
    or jsonb_array_length(p_option_orders) <> v_count then
    raise exception 'Question count or option order is invalid';
  end if;

  for v_order in select value from jsonb_array_elements(p_option_orders)
  loop
    if jsonb_typeof(v_order) <> 'array'
      or jsonb_array_length(v_order) <> 4
      or exists (
        select 1 from jsonb_array_elements_text(v_order) as item(value)
        where item.value !~ '^[0-3]$'
      )
      or (select count(distinct item.value)
          from jsonb_array_elements_text(v_order) as item(value)) <> 4 then
      raise exception 'Each option order must be a permutation of 0,1,2,3';
    end if;
  end loop;

  if not exists (
    select 1 from public.exams e
    where e.id = p_exam_id and e.is_active = true
  ) then
    raise exception 'Exam not found';
  end if;

  select count(distinct qb.id) into v_valid
  from jsonb_array_elements_text(p_question_ids) as ids(question_id)
  join public.question_bank qb on qb.id = ids.question_id::uuid
  where qb.exam_id = p_exam_id and qb.active = true and qb.verified = true;

  if v_valid <> v_count then
    raise exception 'Question set is not valid for this exam';
  end if;

  insert into public.mock_test_sessions(exam_id, question_ids, session_key, option_orders)
  values (p_exam_id, p_question_ids, p_session_key, p_option_orders)
  returning id into v_session_id;

  return v_session_id;
end;
$function$;

revoke all on function public.create_mock_test_session(uuid, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_mock_test_session(uuid, jsonb, uuid, jsonb) to service_role;

create or replace function public.submit_mock_test(
  p_session_id uuid,
  p_session_key uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_session public.mock_test_sessions%rowtype;
  v_exam public.exams%rowtype;
  v_q record;
  v_answer_text text;
  v_answer integer;
  v_original_answer integer;
  v_order jsonb;
  v_display_answer integer;
  v_display_options jsonb;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_unanswered integer := 0;
  v_total integer := 0;
  v_gross numeric;
  v_negative numeric;
  v_score numeric;
  v_accuracy integer;
  v_review jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if p_session_id is null or p_session_key is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Invalid test submission';
  end if;

  select * into v_session
  from public.mock_test_sessions
  where id = p_session_id and session_key = p_session_key
  for update;

  if not found then raise exception 'Test session not found'; end if;
  if v_session.submitted_at is not null then
    if v_session.result is not null then return v_session.result; end if;
    raise exception 'This test has already been submitted';
  end if;
  if v_session.expires_at < now() then raise exception 'Test session expired'; end if;

  select * into v_exam from public.exams where id = v_session.exam_id and is_active = true;
  if not found then raise exception 'Exam configuration unavailable'; end if;

  for v_q in
    select qb.id, qb.answer_index, qb.explanation_hi, qb.explanation_en,
           qb.question_hi, qb.question_en, qb.options, qb.subject, qb.topic,
           qb.source_type, qb.source_year, ids.ordinality::integer as local_id
    from jsonb_array_elements_text(v_session.question_ids) with ordinality as ids(question_id, ordinality)
    join public.question_bank qb on qb.id = ids.question_id::uuid
    where qb.exam_id = v_session.exam_id and qb.active = true and qb.verified = true
    order by ids.ordinality
  loop
    v_total := v_total + 1;
    v_order := v_session.option_orders -> (v_q.local_id - 1);

    -- Sessions created before this migration have no saved order and retain
    -- the original A/B/C/D mapping.
    if coalesce(jsonb_typeof(v_order), '') <> 'array' or jsonb_array_length(v_order) <> 4 then
      v_order := '[0,1,2,3]'::jsonb;
    end if;

    v_answer_text := p_answers ->> v_q.local_id::text;
    if v_answer_text is null or v_answer_text = '' then
      v_unanswered := v_unanswered + 1;
      v_answer := null;
      v_display_answer := null;
    else
      if v_answer_text !~ '^[0-3]$' then raise exception 'Invalid answer option'; end if;
      v_answer := v_answer_text::integer;
      v_original_answer := (v_order ->> v_answer)::integer;
      if v_original_answer = v_q.answer_index then
        v_correct := v_correct + 1;
      else
        v_wrong := v_wrong + 1;
      end if;
      select (item.ordinality - 1)::integer into v_display_answer
      from jsonb_array_elements_text(v_order) with ordinality as item(value, ordinality)
      where item.value::integer = v_q.answer_index;
    end if;

    select jsonb_agg(v_q.options -> (item.value::integer) order by item.ordinality)
      into v_display_options
    from jsonb_array_elements_text(v_order) with ordinality as item(value, ordinality);

    v_review := v_review || jsonb_build_array(jsonb_build_object(
      'id', v_q.local_id,
      'answer', v_display_answer,
      'explanation', coalesce(v_q.explanation_hi, v_q.explanation_en, ''),
      'explanation_hi', coalesce(v_q.explanation_hi, ''),
      'explanation_en', coalesce(v_q.explanation_en, ''),
      'question', coalesce(v_q.question_hi, v_q.question_en, ''),
      'options', v_display_options,
      'subject', coalesce(v_q.subject, 'General'),
      'topic', coalesce(v_q.topic, ''),
      'sourceType', coalesce(v_q.source_type, 'curated'),
      'sourceYear', v_q.source_year
    ));
  end loop;

  if v_total <> jsonb_array_length(v_session.question_ids) then
    raise exception 'Question set is no longer valid';
  end if;

  v_gross := v_correct * coalesce(v_exam.marks_per_question, 1);
  v_negative := v_wrong * coalesce(v_exam.negative_marks, 0);
  v_score := greatest(0, v_gross - v_negative);
  v_accuracy := round(v_correct::numeric / greatest(1, v_total) * 100)::integer;

  v_result := jsonb_build_object(
    'exam_id', v_exam.id,
    'test_name', v_exam.name,
    'total_questions', v_total,
    'correct', v_correct,
    'wrong', v_wrong,
    'unanswered', v_unanswered,
    'score', v_score,
    'gross_score', v_gross,
    'negative_score', v_negative,
    'accuracy', v_accuracy,
    'marks_per_question', coalesce(v_exam.marks_per_question, 1),
    'negative_marks_per_question', coalesce(v_exam.negative_marks, 0),
    'passing_percentage', coalesce(v_exam.passing_percentage, 0),
    'answers', p_answers,
    'review', v_review
  );

  update public.mock_test_sessions
  set submitted_at = now(), result = v_result
  where id = v_session.id;

  return v_result;
end;
$function$;

revoke all on function public.submit_mock_test(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_mock_test(uuid, uuid, jsonb) to service_role;
