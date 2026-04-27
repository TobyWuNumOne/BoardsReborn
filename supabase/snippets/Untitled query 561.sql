insert into public.admin_profiles (id, display_name)
select id, 'Cody'
from auth.users
where id = '0832dfd4-b062-478e-95c4-c7d2eeaa7393';
