import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import { colors } from '../theme'

export default function RecipesScreen() {
  const { household } = useAuth()
  const { recipes, loading, deleteRecipe } = useRecipes(household.id)
  const navigate = useNavigate()

  function handleDelete(recipe) {
    if (window.confirm(`Delete "${recipe.name}"?`)) {
      deleteRecipe(recipe.id)
    }
  }

  return (
    <div style={{ paddingTop: '1rem' }}>
      <div style={styles.header}>
        <button type="button" style={styles.backButton} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2 style={styles.title}>Recipes</h2>
      </div>

      <Link to="/recipes/new" style={styles.addLink}>
        + Add recipe
      </Link>

      {loading && <p style={styles.muted}>Loading…</p>}
      {!loading && recipes.length === 0 && <p style={styles.muted}>No recipes yet.</p>}

      <ul style={styles.list}>
        {recipes.map((recipe) => (
          <li key={recipe.id} style={styles.row}>
            <Link to={`/recipes/${recipe.id}/cook`} style={styles.recipeLink}>
              <span style={styles.recipeName}>{recipe.name}</span>
              <span style={styles.recipeMeta}>
                {recipe.recipe_ingredients.length} ingredient{recipe.recipe_ingredients.length === 1 ? '' : 's'}
              </span>
            </Link>
            <div style={styles.rowActions}>
              <Link to={`/recipes/${recipe.id}/edit`} style={styles.iconLink} aria-label="Edit recipe">
                ✎
              </Link>
              <button
                type="button"
                style={styles.deleteButton}
                onClick={() => handleDelete(recipe)}
                aria-label="Delete recipe"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  backButton: {
    border: 'none',
    background: 'none',
    color: colors.primary,
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
  },
  addLink: {
    display: 'inline-block',
    marginBottom: '1rem',
    color: colors.primary,
    fontWeight: 600,
    textDecoration: 'none',
  },
  muted: {
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: '2rem',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.6rem 0',
    borderBottom: `1px solid ${colors.border}`,
  },
  recipeLink: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    textDecoration: 'none',
    color: colors.text,
  },
  recipeName: {
    fontSize: '1rem',
  },
  recipeMeta: {
    fontSize: '0.8rem',
    color: colors.mutedText,
  },
  rowActions: {
    display: 'flex',
    gap: '0.25rem',
  },
  iconLink: {
    width: '2rem',
    height: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '0.4rem',
    border: `1px solid ${colors.border}`,
    background: colors.card,
    color: colors.text,
    textDecoration: 'none',
  },
  deleteButton: {
    width: '2rem',
    height: '2rem',
    borderRadius: '0.4rem',
    border: `1px solid ${colors.border}`,
    background: colors.card,
    color: colors.danger,
    cursor: 'pointer',
  },
}
