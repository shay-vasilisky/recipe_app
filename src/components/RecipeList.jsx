import { useState } from 'react'
import { getRecipeRatingSummary } from '../lib/recipe-utils'

const ratingOptions = [1, 2, 3, 4, 5]

function RecipeImage({ recipe }) {
  const [brokenImage, setBrokenImage] = useState(false)

  if (!recipe.imageUrl || brokenImage) {
    return (
      <div className="recipe-card__image recipe-card__image--placeholder">
        <span>{recipe.title?.slice(0, 1).toUpperCase() || '?'}</span>
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

function RecipeRating({ currentUserEmail, isSaving, onRate, recipe }) {
  const { averageRating, currentUserRating, ratingCount } = getRecipeRatingSummary(recipe, currentUserEmail)

  return (
    <div
      className="recipe-rating"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="recipe-rating__stars" role="group" aria-label={`Rate ${recipe.title}`}>
        {ratingOptions.map((value) => {
          const isActive = value <= currentUserRating

          return (
            <button
              aria-label={`Rate ${recipe.title} ${value} star${value === 1 ? '' : 's'}`}
              className={`star-button${isActive ? ' star-button--active' : ''}`}
              disabled={isSaving}
              key={value}
              onClick={() => onRate(recipe, value)}
              type="button"
            >
              <span aria-hidden="true">{isActive ? '★' : '☆'}</span>
            </button>
          )
        })}
      </div>

      <p className="recipe-rating__summary">
        {averageRating === null
          ? 'No ratings yet'
          : `${averageRating.toFixed(1)} average (${ratingCount} rating${ratingCount === 1 ? '' : 's'})`}
      </p>
    </div>
  )
}

function RecipeTags({ onTagClick, recipe }) {
  if (!recipe.tags?.length) {
    return null
  }

  return (
    <div className="recipe-card__tags">
      {recipe.tags.map((tag) => (
        <button
          className="tag-chip"
          key={tag}
          onClick={(event) => {
            event.stopPropagation()
            onTagClick(tag)
          }}
          type="button"
        >
          {tag}
        </button>
      ))}
    </div>
  )
}

export default function RecipeList({
  currentUserEmail,
  loading,
  onDelete,
  onEdit,
  onOpen,
  onRate,
  onSearchChange,
  onSearchClear,
  onTagClick,
  ratingRecipeId,
  recipes,
  searchQuery,
  totalRecipesCount,
}) {
  const hasRecipes = totalRecipesCount > 0
  const trimmedSearchQuery = searchQuery.trim()

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

  return (
    <section className={`panel${hasRecipes ? '' : ' panel--empty'}`}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Recipes</p>
          <h2>
            {hasRecipes
              ? recipes.length === totalRecipesCount
                ? `${totalRecipesCount} saved`
                : `${recipes.length} of ${totalRecipesCount} saved`
              : 'No recipes yet'}
          </h2>
        </div>
      </div>

      {hasRecipes ? (
        <div className="recipe-search">
          <label className="recipe-search__field" htmlFor="recipe-search">
            <span>Search everything</span>
            <input
              autoComplete="off"
              id="recipe-search"
              onChange={onSearchChange}
              placeholder="Search by title, tags, notes, URL, or who added it"
              type="search"
              value={searchQuery}
            />
          </label>
          {trimmedSearchQuery ? (
            <button className="ghost-button" onClick={onSearchClear} type="button">
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {!hasRecipes ? (
        <p>
          Add the first recipe with a title and source URL. Everything else is optional.
        </p>
      ) : !recipes.length ? (
        <div className="recipe-empty-results">
          <p className="recipe-empty-results__title">No matches for "{trimmedSearchQuery}"</p>
          <p className="recipe-empty-results__copy">
            Try a different word, remove a search term, or tap a tag on another recipe to narrow from there.
          </p>
          <button className="ghost-button" onClick={onSearchClear} type="button">
            Clear search
          </button>
        </div>
      ) : (
        <div className="recipe-list">
          {recipes.map((recipe) => (
            <article
              className="recipe-card"
              key={recipe.id}
              onClick={() => onOpen(recipe.sourceUrl)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) {
                  return
                }

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

                <RecipeTags onTagClick={onTagClick} recipe={recipe} />

                <RecipeRating
                  currentUserEmail={currentUserEmail}
                  isSaving={ratingRecipeId === recipe.id}
                  onRate={onRate}
                  recipe={recipe}
                />

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
      )}
    </section>
  )
}
