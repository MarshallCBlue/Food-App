import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SkeletonRows from '../components/Skeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'

// A tab of its own now, rather than a text link hidden at the top of the
// inventory screen — so it has no back button, the same as the other
// three tabs.
export default function RecipesScreen() {
  const { household } = useAuth()
  const { recipes, loading, deleteRecipe } = useRecipes(household.id)
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState(null)

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

      {recipes.length > 0 && (
        <section className="fm-group" style={{ marginTop: '1.5rem' }}>
          <div className="fm-rail">
            <h2 className="fm-rail__name">Saved</h2>
            <span className="fm-rail__count">{recipes.length}</span>
          </div>

          {recipes.map((recipe) => (
            <div className="fm-row" key={recipe.id}>
              <div className="fm-row__main">
                <Link to={`/recipes/${recipe.id}/cook`} className="fm-row__button" style={{ color: 'inherit' }}>
                  <span className="fm-row__label">
                    <span className="fm-row__name">{recipe.name}</span>
                    <span className="fm-row__meta">
                      {recipe.recipe_ingredients.length} ingredient
                      {recipe.recipe_ingredients.length === 1 ? '' : 's'}
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
            deleteRecipe(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}
