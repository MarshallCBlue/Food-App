-- Recipes get a method and a photo.
--
-- instructions: plain text, one step per line.
-- image_path:   where the photo sits in the recipe-images storage bucket,
--               e.g. "<household id>/<random id>.jpg". The path is saved
--               rather than a full web address, so the app can rebuild the
--               address itself if the project address ever changes.
alter table public.recipes add column if not exists instructions text;
alter table public.recipes add column if not exists image_path text;

-- The storage bucket for recipe photos. 5 MB per file is plenty, because
-- the app shrinks photos before uploading them. Public means a photo can be
-- viewed by anyone who has its exact address; those addresses contain a
-- random id, so they cannot be guessed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Only members of a household can add, replace or remove photos, and only
-- inside their own household's folder (the first part of the path).
-- Admins can too, matching how every other table treats them.
create policy recipe_images_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (
      (storage.foldername(name))[1] in (select h::text from public.current_household_ids() as h)
      or (select public.is_admin())
    )
  );

create policy recipe_images_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (
      (storage.foldername(name))[1] in (select h::text from public.current_household_ids() as h)
      or (select public.is_admin())
    )
  );

create policy recipe_images_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (
      (storage.foldername(name))[1] in (select h::text from public.current_household_ids() as h)
      or (select public.is_admin())
    )
  );
