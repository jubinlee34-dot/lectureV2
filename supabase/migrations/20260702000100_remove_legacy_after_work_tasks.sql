-- Remove legacy default after-lecture work tasks that were seeded before the template was simplified.
-- This only deletes exact default task rows from the after-lecture task stage.
DELETE FROM public.work_tasks
WHERE stage = 'after'
  AND (
    (category = 'contact' AND text = '담당자에게 감사 문자 발송')
    OR (category = 'invoice' AND text = '강사료 청구서 발송')
  );
