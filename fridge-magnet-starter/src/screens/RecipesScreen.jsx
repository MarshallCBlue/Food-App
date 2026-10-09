import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import { allTags, hasAllTags, sameTag } from '../lib/recipeTags'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SkeletonRows from '../components/Skeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'
import { useErrorToast } from '../components/useErrorToast'

// A tab of its own now, rather than a text link hidden at the top of the
// inventory screen — so it has no back button, the same as the other
// tabs. Tags along the top filter the list: pick several and only
// recipes carrying every picked tag are shown.
export default function RecipesScreen() {
  const { household } = useAuth()
  const { recipes, loading, deleteRecipe } = useRecipes(household.id)
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState(null)
  const [chosenTags, setChosenTags] = useState([])
  const [attempt, errorToast] = useErrorToast()

  const tagsInUse = useMemo(() => allTags(recipes), [recipes])

  // If a chosen tag disappears (its last recipe was deleted or edited),
  // it quietly stops filtering instead of hiding everything.
  const activeTags = chosenTags.filter((tag) => tagsInUse.some((used) => sameTag(used, tag)))
  const shown = recipes.filter((recipe) => hasAllTags(recipe, activeTags))

  function toggleTag(tag) {
    setChosenTags((current) =>
      current.some((chosen) => sameTag(chosen, tag))
        ? current.filter((chosen) => !sameTag(chosen, tag))
        : [...current, tag]
    )
  }

  return (
    <div>
      <PageHeader
        title="Recipes"
        subtitle={
          recipes.length > 0
            ? `${recipes.length} saved. Cooking one takes its ingredients out of the inventory.`
            : 'Cook one and its ingredients come out of the inventory'
        }
      />

      <button type="button" className="fm-btn fm-btn--block" onClick={() => navigate('/recipes/new')}>
        <Icon name="plus" />
        New recipe
      </button>

      {tagsInUse.length > 0 && (
        <div className="fm-chips fm-chips--wrap fm-filter" role="group" aria-label="Filter recipes by tag">
          {tagsInUse.map((tag) => {
            const on = activeTags.some((chosen) => sameTag(chosen, tag))
            return (
              <button
                key={tag}
                type="button"
                className={`fm-chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
              >
                {on && <Icon name="check" />}
                {tag}
              </button>
            )
          })}
          {activeTags.length > 0 && (
            <button type="button" className="fm-chip fm-chip--quiet" onClick={() => setChosenTags([])}>
              Clear
            </button>
          )}
        </div>
      )}

      {loading && (
        <div style={{ marginTop: '1.5rem' }}>
          <SkeletonRows rows={3} />
        </div>
      )}

      {!loading && recipes.length === 0 && (
        <EmptyState
          icon="recipes"
          title="No recipes yet"
          body="Save the things you cook often. When you cook one, Fridge Magnet takes the ingredients out of your inventory and offers to put whatever ran short on the shopping list."
        />
      )}

      {!loading && recipes.length > 0 && shown.length === 0 && (
        <EmptyState
          icon="recipes"
          title="No recipes match"
          body={`Nothing is tagged with all of: ${activeTags.join(', ')}.`}
          action={
            <button type="button" className="fm-btn fm-btn--secondary" onClick={() => setChosenTags([])}>
              Show all recipes
            </button>
          }
        />
      )}

      {shown.length > 0 && (
        <section className="fm-group" style={{ marginTop: '1.5rem' }}>
          <div className="fm-rail">
            <h2 className="fm-rail__name">{activeTags.length > 0 ? 'Matching' : 'Saved'}</h2>
            <span className="fm-rail__count">{shown.length}</span>
          </div>

          {shown.map((recipe) => (
            <div className="fm-row" key={recipe.id}>
              <div className="fm-row__main">
                <Link to={`/recipes/${recipe.id}/cook`} className="fm-row__button" style={{ color: 'inherit' }}>
                  <span className="fm-row__label">
                    <span className="fm-row__name">{recipe.name}</span>
                    <span className="fm-row__meta">
                      {recipe.recipe_ingredients.length} ingredient
                      {recipe.recipe_ingredients.length === 1 ? '' : 's'}
                      {recipe.tags?.length > 0 && ` · ${recipe.tags.join(', ')}`}
                    </span>
                  </span>
                </Link>

                <Link
                  to={`/recipes/${recipe.id}/edit`}
                  className="fm-icon-btn"
                  aria-label={`Edit ${recipe.name}`}
                >
                  <Icon name="edit" />
                </Link>
                <button
                  type="button"
                  className="fm-icon-btn fm-icon-btn--danger"
                  onClick={() => setPendingDelete(recipe)}
                  aria-label={`Delete ${recipe.name}`}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          body="The recipe and its ingredient list go for good. Nothing in your inventory changes."
          confirmLabel="Delete recipe"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const recipe = pendingDelete
            setPendingDelete(null)
            attempt(() => deleteRecipe(recipe.id))
          }}
        />
      )}

      {errorToast}
    </div>
  )
}
