-- Access-rule (RLS) checks for wish-list claims and the viewer share role.
-- Runs in one transaction and ROLLS BACK, so it leaves no data behind.
-- Run: npx -y supabase@2 db query --linked -f supabase/tests/wish_list_claims_rls.sql -o json
-- Every row in the output should say PASS. Uses the two e2e test accounts.

begin;
create temp table t_results(n serial, check_name text, outcome text);
grant all on t_results to authenticated;
grant usage on sequence t_results_n_seq to authenticated;

do $$
declare
  owner_id uuid := '3bbf2d4b-b23b-4cf4-bbc1-22759fc53b85';
  giver_id uuid := '89c6e87f-70c1-4f8c-8c71-c58cd727abd7';
  owner_claims text := json_build_object('sub', '3bbf2d4b-b23b-4cf4-bbc1-22759fc53b85', 'email', 'e2e-test@gatherapp.dev', 'role', 'authenticated')::text;
  giver_claims text := json_build_object('sub', '89c6e87f-70c1-4f8c-8c71-c58cd727abd7', 'email', 'e2e-test@gatherlists.com', 'role', 'authenticated')::text;
  wl uuid; gl uuid; it uuid; git uuid; n int;
begin
  insert into lists (owner_id, name, type) values (owner_id, 'RLS test wish', 'wish_list') returning id into wl;
  insert into lists (owner_id, name, type) values (owner_id, 'RLS test grocery', 'grocery') returning id into gl;
  insert into items (list_id, name, quantity) values (wl, 'Mug', 2) returning id into it;
  insert into items (list_id, name, quantity) values (gl, 'Milk', 1) returning id into git;
  insert into list_shares (list_id, shared_with_email, role) values (wl, 'e2e-test@gatherlists.com', 'viewer');
  insert into list_shares (list_id, shared_with_email, role) values (gl, 'e2e-test@gatherlists.com', 'viewer');

  -- act as the giver (viewer)
  perform set_config('request.jwt.claims', giver_claims, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from items where list_id = wl;
  insert into t_results(check_name, outcome) values ('viewer can read items', case when n = 1 then 'PASS' else 'FAIL n='||n end);

  begin insert into items (list_id, name) values (wl, 'Sneaky');
    insert into t_results(check_name, outcome) values ('viewer cannot add items', 'FAIL inserted');
  exception when others then insert into t_results(check_name, outcome) values ('viewer cannot add items', 'PASS');
  end;

  update items set is_checked = true where id = it;
  get diagnostics n = row_count;
  insert into t_results(check_name, outcome) values ('viewer cannot check off items', case when n = 0 then 'PASS' else 'FAIL updated' end);

  update lists set name = 'hacked' where id = wl;
  get diagnostics n = row_count;
  insert into t_results(check_name, outcome) values ('viewer cannot edit list', case when n = 0 then 'PASS' else 'FAIL updated' end);

  begin update list_shares set role = 'editor' where list_id = wl and shared_with_email = 'e2e-test@gatherlists.com';
    get diagnostics n = row_count;
    insert into t_results(check_name, outcome) values ('viewer cannot promote self', case when n = 0 then 'PASS (no row)' else 'FAIL updated' end);
  exception when others then insert into t_results(check_name, outcome) values ('viewer cannot promote self', 'PASS');
  end;

  begin insert into item_claims (item_id, list_id, claimed_by, quantity) values (it, wl, giver_id, 1);
    insert into t_results(check_name, outcome) values ('giver can claim 1 of 2', 'PASS');
  exception when others then insert into t_results(check_name, outcome) values ('giver can claim 1 of 2', 'FAIL '||sqlerrm);
  end;

  begin update item_claims set quantity = 3 where item_id = it and claimed_by = giver_id;
    insert into t_results(check_name, outcome) values ('claim cannot exceed quantity', 'FAIL allowed 3 of 2');
  exception when others then insert into t_results(check_name, outcome) values ('claim cannot exceed quantity', 'PASS ('||sqlerrm||')');
  end;

  begin insert into item_claims (item_id, list_id, claimed_by) values (it, wl, owner_id);
    insert into t_results(check_name, outcome) values ('giver cannot claim for someone else', 'FAIL inserted');
  exception when others then insert into t_results(check_name, outcome) values ('giver cannot claim for someone else', 'PASS');
  end;

  begin insert into item_claims (item_id, list_id, claimed_by) values (git, gl, giver_id);
    insert into t_results(check_name, outcome) values ('no claims on non-wish lists', 'FAIL inserted');
  exception when others then insert into t_results(check_name, outcome) values ('no claims on non-wish lists', 'PASS');
  end;

  select count(*) into n from item_claims where list_id = wl;
  insert into t_results(check_name, outcome) values ('giver sees claims', case when n = 1 then 'PASS' else 'FAIL n='||n end);

  -- act as the owner
  perform set_config('request.jwt.claims', owner_claims, true);

  select count(*) into n from item_claims where list_id = wl;
  insert into t_results(check_name, outcome) values ('owner cannot see claims', case when n = 0 then 'PASS' else 'FAIL n='||n end);

  begin insert into item_claims (item_id, list_id, claimed_by) values (it, wl, owner_id);
    insert into t_results(check_name, outcome) values ('owner cannot claim', 'FAIL inserted');
  exception when others then insert into t_results(check_name, outcome) values ('owner cannot claim', 'PASS');
  end;

  delete from item_claims where list_id = wl;
  get diagnostics n = row_count;
  insert into t_results(check_name, outcome) values ('owner cannot delete claims', case when n = 0 then 'PASS' else 'FAIL deleted' end);

  update items set is_checked = true where id = it;
  get diagnostics n = row_count;
  insert into t_results(check_name, outcome) values ('owner can still edit items', case when n = 1 then 'PASS' else 'FAIL' end);

  update lists set reveal_claims = true where id = wl;
  select count(*) into n from item_claims where list_id = wl;
  insert into t_results(check_name, outcome) values ('owner sees claims after reveal', case when n = 1 then 'PASS' else 'FAIL n='||n end);

  -- owner upgrades giver to editor
  update list_shares set role = 'editor' where list_id = wl;
  perform set_config('request.jwt.claims', giver_claims, true);
  begin insert into items (list_id, name) values (wl, 'Allowed now');
    insert into t_results(check_name, outcome) values ('editor can add items', 'PASS');
  exception when others then insert into t_results(check_name, outcome) values ('editor can add items', 'FAIL '||sqlerrm);
  end;

  perform set_config('role', 'postgres', true);
end $$;

select n, check_name, outcome from t_results order by n;
rollback;
