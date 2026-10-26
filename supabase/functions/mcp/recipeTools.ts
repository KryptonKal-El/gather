/**
 * Phase 2 write tools for recipes, recipe tags (recipe_attributes), and
 * recipe collections.
 *
 * Ingredient and step ids are not stable (both apps rewrite them on every
 * edit), so updates replace the whole ingredient or step list. The recipe's
 * ingredient_count / step_count / cook_count are trigger-maintained and are
 * never written here.
 */
import { McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0';
import { z } from 'npm:zod@^4.3.6';
import {
  DESTRUCTIVE,
  IDEMPOTENT_WRITE,
  type ToolContext,
  WRITE,
  definedOnly,
  errorResult,
  jsonResult,
  uuid,
} from './shared.ts';

const RECIPE_IMAGE_BUCKET = 'recipe-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const COURSES = ['main', 'side', 'dessert', 'snack', 'drink', 'component'] as const;
const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
const PROTEINS = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'shellfish', 'eggs', 'tofu', 'beans', 'dairy', 'none'] as const;
const CUISINES = [
  'american', 'mexican', 'italian', 'french', 'spanish', 'greek', 'mediterranean', 'middle_eastern',
  'indian', 'chinese', 'japanese', 'korean', 'thai', 'vietnamese', 'caribbean', 'african', 'other',
] as const;
const EFFORTS = ['quick', 'medium', 'project'] as const;
const METHODS = ['stovetop', 'oven', 'grill', 'slow_cooker', 'pressure_cooker', 'air_fryer', 'fried', 'no_cook'] as const;

const ingredientsSchema = z.array(z.object({
  name: z.string().min(1).max(200).describe('Ingredient, e.g. "yellow onion, diced".'),
  quantity: z.string().max(50).nullable().optional().describe('Amount as text, e.g. "2 cups" or "1".'),
})).max(200);

const stepsSchema = z.array(z.string().min(1).max(4000)).max(100).describe('Instructions in order, one string per step.');

/** Planner tags; each one passed is recorded as a manual edit so auto-tagging won't overwrite it. */
export const tagsShape = {
  course: z.enum(COURSES).nullable().optional(),
  meal_types: z.array(z.enum(MEALS)).optional().describe('Which meals this recipe suits.'),
  protein: z.enum(PROTEINS).nullable().optional(),
  cuisine: z.enum(CUISINES).nullable().optional(),
  effort: z.enum(EFFORTS).nullable().optional(),
  method: z.enum(METHODS).nullable().optional(),
  kid_friendly: z.boolean().nullable().optional(),
  perishables: z.array(z.string().max(100)).max(50).optional()
    .describe('Ingredients likely to spoil (used to plan leftovers around them).'),
};
const tagsSchema = z.object(tagsShape);
type Tags = z.infer<typeof tagsSchema>;

// Fields recorded in recipe_attributes.manual_fields (shared with iOS); perishables is not one.
const MANUAL_FIELDS = ['course', 'meal_types', 'protein', 'cuisine', 'effort', 'method', 'kid_friendly'];

const metadataShape = {
  description: z.string().max(4000).nullable().optional(),
  prep_time: z.string().max(50).nullable().optional().describe('Free text, e.g. "15 min".'),
  cook_time: z.string().max(50).nullable().optional().describe('Free text, e.g. "1 hr".'),
  servings: z.number().int().min(1).max(100).nullable().optional(),
  source_name: z.string().max(200).nullable().optional().describe('Where the recipe came from.'),
  source_url: z.string().url().nullable().optional(),
  image_url: z.string().url().nullable().optional()
    .describe('External image URL to show as-is. Use recipes_set_image to copy an image into Gather storage instead.'),
};

/** Returns the user's default collection id, creating "My Recipes" if they have none. */
async function ensureDefaultCollection({ supabase, userId }: ToolContext): Promise<string> {
  const { data, error } = await supabase
    .from('collections')
    .select('id')
    .eq('owner_id', userId)
    .eq('is_default', true)
    .maybeSingle();
  if (error) throw new Error('Failed to look up default collection', { cause: error });
  if (data) return data.id;
  const { data: created, error: insertError } = await supabase
    .from('collections')
    .insert({ owner_id: userId, name: 'My Recipes', emoji: '📖', is_default: true, sort_order: 0 })
    .select('id')
    .single();
  if (insertError) throw new Error('Failed to create default collection', { cause: insertError });
  return created.id;
}

/**
 * Replaces a recipe's ingredients. New rows go in before old rows are removed,
 * so a failure never leaves the recipe with no ingredients.
 */
async function replaceIngredients(supabase: any, recipeId: string, ingredients: z.infer<typeof ingredientsSchema>) {
  const { data: old, error: oldError } = await supabase.from('recipe_ingredients').select('id').eq('recipe_id', recipeId);
  if (oldError) throw new Error(`Failed to read ingredients: recipeId=${recipeId}`, { cause: oldError });
  if (ingredients.length) {
    const { error } = await supabase.from('recipe_ingredients').insert(
      ingredients.map((ing, i) => ({ recipe_id: recipeId, name: ing.name, quantity: ing.quantity ?? null, sort_order: i })),
    );
    if (error) throw new Error(`Failed to save ingredients: recipeId=${recipeId}`, { cause: error });
  }
  if (old.length) {
    const { error } = await supabase.from('recipe_ingredients').delete().in('id', old.map((r: { id: string }) => r.id));
    if (error) throw new Error(`Failed to remove old ingredients: recipeId=${recipeId}`, { cause: error });
  }
}

/** Replaces a recipe's steps, insert-then-delete like {@link replaceIngredients}. */
async function replaceSteps(supabase: any, recipeId: string, steps: string[]) {
  const { data: old, error: oldError } = await supabase.from('recipe_steps').select('id').eq('recipe_id', recipeId);
  if (oldError) throw new Error(`Failed to read steps: recipeId=${recipeId}`, { cause: oldError });
  if (steps.length) {
    const { error } = await supabase.from('recipe_steps').insert(
      steps.map((instruction, i) => ({ recipe_id: recipeId, instruction, sort_order: i })),
    );
    if (error) throw new Error(`Failed to save steps: recipeId=${recipeId}`, { cause: error });
  }
  if (old.length) {
    const { error } = await supabase.from('recipe_steps').delete().in('id', old.map((r: { id: string }) => r.id));
    if (error) throw new Error(`Failed to remove old steps: recipeId=${recipeId}`, { cause: error });
  }
}

/** Merges `tags` into the recipe's attributes row and marks those fields as manually set. */
async function saveTags({ supabase, userId }: ToolContext, recipeId: string, tags: Tags) {
  const provided = definedOnly(tags);
  if (Object.keys(provided).length === 0) return null;
  const { data: existing, error: readError } = await supabase
    .from('recipe_attributes')
    .select('manual_fields')
    .eq('recipe_id', recipeId)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read recipe tags: recipeId=${recipeId}`, { cause: readError });
  const manual = new Set<string>(existing?.manual_fields ?? []);
  for (const field of Object.keys(provided)) if (MANUAL_FIELDS.includes(field)) manual.add(field);
  const { data, error } = await supabase
    .from('recipe_attributes')
    .upsert(
      {
        recipe_id: recipeId,
        ...provided,
        manual_fields: MANUAL_FIELDS.filter((f) => manual.has(f)),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'recipe_id' },
    )
    .select('course, meal_types, protein, cuisine, effort, method, kid_friendly, perishables')
    .single();
  if (error) throw new Error(`Failed to save recipe tags: recipeId=${recipeId}`, { cause: error });
  return data;
}

/** Rejects URLs that could point the function at internal hosts. */
function assertPublicHttpsUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Image URL must use https.');
  const host = url.hostname;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) {
    throw new Error('Image URL must be a public hostname.');
  }
}

/** Registers recipe, recipe-tag, and collection write tools. */
export function registerRecipeTools(server: McpServer, ctx: ToolContext) {
  const { supabase, userId } = ctx;

  // ---------------------------------------------------------------- recipes

  server.registerTool(
    'recipes_create',
    {
      title: 'Create a recipe',
      description:
        'Create a recipe with ingredients, steps, and optional planner tags. Goes into the given collection, or the user\'s default collection. Create a recipe here before planning it on the meal plan.',
      annotations: WRITE,
      inputSchema: z.object({
        name: z.string().min(1).max(200),
        collection_id: z.string().uuid().optional().describe('Target collection (owned or shared). Default: the user\'s default collection.'),
        ingredients: ingredientsSchema.optional(),
        steps: stepsSchema.optional(),
        tags: tagsSchema.optional().describe('Planner tags (course, meals, protein, cuisine, effort, method, kid-friendly, perishables).'),
        ...metadataShape,
      }),
    },
    async ({ name, collection_id, ingredients = [], steps = [], tags, ...metadata }) => {
      const collectionId = collection_id ?? await ensureDefaultCollection(ctx);
      const { data: recipe, error } = await supabase
        .from('recipes')
        .insert({ owner_id: userId, name, collection_id: collectionId, ...definedOnly(metadata) })
        .select('id, name, collection_id')
        .single();
      if (error) return errorResult(error.message);
      try {
        await replaceIngredients(supabase, recipe.id, ingredients);
        await replaceSteps(supabase, recipe.id, steps);
        const savedTags = tags ? await saveTags(ctx, recipe.id, tags) : null;
        return jsonResult({ ...recipe, ingredient_count: ingredients.length, step_count: steps.length, tags: savedTags });
      } catch (err) {
        return errorResult(`Recipe ${recipe.id} was created but not fully saved: ${(err as Error).message}`);
      }
    },
  );

  server.registerTool(
    'recipes_update',
    {
      title: 'Update a recipe',
      description:
        'Edit a recipe. Only fields you pass change. `ingredients` and `steps`, when passed, REPLACE the full list — send every ingredient/step, not just the changed ones. Pass collection_id to move it.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({
        recipe_id: uuid('The recipe id.'),
        name: z.string().min(1).max(200).optional(),
        collection_id: z.string().uuid().optional().describe('Move to this collection.'),
        ingredients: ingredientsSchema.optional(),
        steps: stepsSchema.optional(),
        ...metadataShape,
      }),
    },
    async ({ recipe_id, ingredients, steps, ...fields }) => {
      const updates = { ...definedOnly(fields), updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('recipes')
        .update(updates)
        .eq('id', recipe_id)
        .select('id, name, collection_id')
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult('Recipe not found or you cannot edit it.');
      try {
        if (ingredients) await replaceIngredients(supabase, recipe_id, ingredients);
        if (steps) await replaceSteps(supabase, recipe_id, steps);
      } catch (err) {
        return errorResult((err as Error).message);
      }
      return jsonResult(data);
    },
  );

  server.registerTool(
    'recipes_delete',
    {
      title: 'Delete a recipe',
      description:
        'Permanently delete a recipe with its ingredients, steps, tags, and cook history. Meal plan slots that used it lose their recipe link. Confirm with the user first.',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({ recipe_id: uuid('The recipe id.') }),
    },
    async ({ recipe_id }) => {
      const { data, error } = await supabase.from('recipes').delete().eq('id', recipe_id).select('id, name');
      if (error) return errorResult(error.message);
      if (!data?.length) return errorResult('Recipe not found or you cannot delete it.');
      return jsonResult({ deleted: data[0] });
    },
  );

  server.registerTool(
    'recipes_set_tags',
    {
      title: 'Set recipe tags',
      description:
        'Set a recipe\'s meal-planner tags. Only tags you pass change; they are marked as set by the user so automatic tagging leaves them alone.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({ recipe_id: uuid('The recipe id.'), ...tagsShape }),
    },
    async ({ recipe_id, ...tags }) => {
      try {
        const saved = await saveTags(ctx, recipe_id, tags);
        if (!saved) return errorResult('No tags given.');
        return jsonResult(saved);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.registerTool(
    'recipes_set_image',
    {
      title: 'Set a recipe photo from a URL',
      description:
        'Download a JPEG/PNG/WebP (max 5 MB) from a public https URL, store it in Gather, and set it as the recipe photo.',
      annotations: { ...IDEMPOTENT_WRITE, openWorldHint: true },
      inputSchema: z.object({
        recipe_id: uuid('The recipe id.'),
        image_url: z.string().url().describe('Public https URL of the image.'),
      }),
    },
    async ({ recipe_id, image_url }) => {
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes').select('id').eq('id', recipe_id).maybeSingle();
      if (recipeError) return errorResult(recipeError.message);
      if (!recipe) return errorResult('Recipe not found or not accessible.');

      let bytes: Uint8Array;
      let contentType: string;
      try {
        assertPublicHttpsUrl(image_url);
        const res = await fetch(image_url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(`Image download failed with HTTP ${res.status}.`);
        contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
        if (!IMAGE_EXTENSIONS[contentType]) throw new Error(`Unsupported image type "${contentType}" (use JPEG, PNG, or WebP).`);
        if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) throw new Error('Image is larger than 5 MB.');
        bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image is larger than 5 MB.');
      } catch (err) {
        return errorResult((err as Error).message);
      }

      // Storage RLS only allows writes under the caller's own {userId}/ folder.
      const path = `${userId}/${recipe_id}.${IMAGE_EXTENSIONS[contentType]}`;
      const { error: uploadError } = await supabase.storage
        .from(RECIPE_IMAGE_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) return errorResult(`Upload failed: ${uploadError.message}`);
      const { data: urlData } = supabase.storage.from(RECIPE_IMAGE_BUCKET).getPublicUrl(path);
      // Same path is reused on replace, so bust client image caches.
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error } = await supabase
        .from('recipes')
        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', recipe_id);
      if (error) return errorResult(error.message);
      return jsonResult({ recipe_id, image_url: publicUrl });
    },
  );

  // ---------------------------------------------------------------- collections

  server.registerTool(
    'collections_create',
    {
      title: 'Create a recipe collection',
      description: 'Create a recipe collection owned by the user.',
      annotations: WRITE,
      inputSchema: z.object({
        name: z.string().min(1).max(100),
        emoji: z.string().max(16).nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
      }),
    },
    async ({ name, emoji = null, description = null }) => {
      const { data: maxRow, error: maxError } = await supabase
        .from('collections')
        .select('sort_order')
        .eq('owner_id', userId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxError) return errorResult(maxError.message);
      const { data, error } = await supabase
        .from('collections')
        .insert({ owner_id: userId, name, emoji, description, sort_order: (maxRow?.sort_order ?? -1) + 1 })
        .select('id, name, emoji, description, is_default, sort_order')
        .single();
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'collections_update',
    {
      title: 'Update a recipe collection',
      description: 'Rename a collection or change its emoji or description.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({
        collection_id: uuid('The collection id.'),
        name: z.string().min(1).max(100).optional(),
        emoji: z.string().max(16).nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
      }),
    },
    async ({ collection_id, ...fields }) => {
      const { data, error } = await supabase
        .from('collections')
        .update({ ...definedOnly(fields), updated_at: new Date().toISOString() })
        .eq('id', collection_id)
        .select('id, name, emoji, description, is_default')
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult('Collection not found or you cannot edit it.');
      return jsonResult(data);
    },
  );

  server.registerTool(
    'collections_delete',
    {
      title: 'Delete a recipe collection',
      description:
        'Delete a collection the user owns. A collection that still has recipes can only be deleted by passing move_recipes_to (its recipes move there first). The default collection cannot be deleted.',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({
        collection_id: uuid('The collection id.'),
        move_recipes_to: z.string().uuid().optional().describe('Collection to move this collection\'s recipes into.'),
      }),
    },
    async ({ collection_id, move_recipes_to }) => {
      const { data: collection, error: readError } = await supabase
        .from('collections')
        .select('id, name, owner_id, is_default')
        .eq('id', collection_id)
        .maybeSingle();
      if (readError) return errorResult(readError.message);
      if (!collection || collection.owner_id !== userId) return errorResult('Collection not found or you do not own it.');
      if (collection.is_default) return errorResult('The default collection cannot be deleted.');
      if (move_recipes_to === collection_id) return errorResult('move_recipes_to must be a different collection.');

      const { count, error: countError } = await supabase
        .from('recipes')
        .select('id', { count: 'exact', head: true })
        .eq('collection_id', collection_id);
      if (countError) return errorResult(countError.message);
      if (count && !move_recipes_to) {
        return errorResult(`This collection has ${count} recipe(s). Pass move_recipes_to to move them before deleting.`);
      }
      if (count && move_recipes_to) {
        const { data: moved, error: moveError } = await supabase
          .from('recipes')
          .update({ collection_id: move_recipes_to, updated_at: new Date().toISOString() })
          .eq('collection_id', collection_id)
          .select('id');
        if (moveError) return errorResult(`Failed to move recipes: ${moveError.message}`);
        if (moved.length < count) {
          return errorResult(`Only ${moved.length} of ${count} recipes could be moved (some belong to collaborators); the collection was not deleted.`);
        }
      }
      const { error } = await supabase.from('collections').delete().eq('id', collection_id);
      if (error) return errorResult(error.message);
      return jsonResult({ deleted: { id: collection.id, name: collection.name }, recipes_moved: count ?? 0 });
    },
  );
}
