-- Retain historical WhatsApp data but disable sending endpoints until reactivated.
revoke execute on function public.optimus_task_digests(text) from anon, authenticated;
revoke execute on function public.optimus_task_delivery_log(text,uuid,date,text,boolean,text) from anon, authenticated;
