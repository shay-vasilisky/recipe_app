import { useState } from 'react'

function RecipeImage({ recipe }) {
  const [brokenImage, setBrokenImage] = useState(false)

  if (!recipe.imageUrl || brokenImage) {
    return (
      <div className="recipe-card__image recipe-card__image--placeholder">
        <span>{recipe.title.slice(0, 1).toUpperCase()}</span>
      </div>
    )
  }

  return (
    <img
      alt={recipe.title}
      className="recipe-card__image"
      onError={() => setBrokenImage(true)}
      src={recipe.imageUrl}
    />
  )
}

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return 'Just added'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(timestamp.toDate())
}

export default function RecipeList({
  loading,
  recipes,
  onDelete,
  onEdit,
  onOpen,
}) {
  if (loading) {
    return (
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Recipes</p>
            <h2>Loading your shared list…</h2>
          </div>
        </div>
      </section>
    )
  }

  if (!recipes.length) {
    return (
      <section className="panel panel--empty">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Recipes</p>
            <h2>No recipes yet</h2>
          </div>
        </div>
        <p>
          Add the first recipe with a title and source URL. Everything else is optional.
        </p>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Recipes</p>
          <h2>{recipes.length} saved</h2>
        </div>
      </div>

      <div className="recipe-list">
        {recipes.map((recipe) => (
          <article
            className="recipe-card"
            key={recipe.id}
            onClick={() => onOpen(recipe.sourceUrl)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen(recipe.sourceUrl)
              }
            }}
            role="button"
            tabIndex={0}
          >
            <RecipeImage recipe={recipe} />

            <div className="recipe-card__content">
              <div className="recipe-card__meta">
                <p className="recipe-card__date">{formatTimestamp(recipe.updatedAt)}</p>
                <p className="recipe-card__added-by">{recipe.createdBy || 'Shared recipe'}</p>
              </div>

              <div className="recipe-card__body">
                <h3>{recipe.title}</h3>
                {recipe.description ? (
                  <p className="recipe-card__description">{recipe.description}</p>
                ) : (
                  <p className="recipe-card__description recipe-card__description--muted">
                    No description added.
                  </p>
                )}
              </div>

              <div className="recipe-card__footer">
                <a
                  className="text-link"
                  href={recipe.sourceUrl}
                  onClick={(event) => event.stopPropagation()}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open source
                </a>

                <div className="recipe-card__actions">
                  <button
                    className="ghost-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit(recipe)
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="ghost-button ghost-button--danger"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(recipe)
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
