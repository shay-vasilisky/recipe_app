import { useEffect, useMemo, useState } from 'react'
import ManagedTagAutocomplete from './ManagedTagAutocomplete'
import {
  MAX_TOTAL_TIME_OPTIONS,
  MINIMUM_RATING_OPTIONS,
  SORT_OPTIONS,
  getEffectiveSearchSort,
} from '../lib/search-utils'
import {
  MEAL_TYPE_OPTIONS,
  getContentTextProps,
  getRecipeRatingSummary,
  getRecipeSourceHost,
} from '../lib/recipe-utils'
import { getResolvedRecipeTags } from '../lib/tag-utils'

const mealTypeLabelByValue = Object.fromEntries(
  MEAL_TYPE_OPTIONS.filter((option) => option.value).map((option) => [option.value, option.label]),
)

const ratingOptions = [1, 2, 3, 4, 5]

function RecipeImage({ recipe }) {
  const [brokenImage, setBrokenImage] = useState(false)

  if (!recipe.imageUrl || brokenImage) {
    return (
      <div aria-hidden="true" className="recipe-card__image recipe-card__image--placeholder">
        <div className="recipe-card__placeholder-art">
          <span />
          <span />
          <span />
        </div>
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

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(timestamp.toDate())
}

function RecipeRating({ currentUserEmail, isSaving, onRate, recipe }) {
  const { averageRating, currentUserRating, ratingCount } = getRecipeRatingSummary(recipe, currentUserEmail)

  return (
    <div className="recipe-rating">
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
          : `${averageRating.toFixed(1)} average from ${ratingCount} rating${ratingCount === 1 ? '' : 's'}`}
      </p>
    </div>
  )
}

function RecipeTags({ activeTagIds, onTagClick, recipeTags }) {
  if (!recipeTags.length) {
    return null
  }

  return (
    <div className="recipe-card__tags">
      {recipeTags.map((tag) => (
        <button
          className={`tag-chip${activeTagIds.includes(tag.id) ? ' tag-chip--active-filter' : ''}`}
          key={tag.id}
          onClick={() => onTagClick(tag.id)}
          type="button"
        >
          <span className="content-text tag-chip__label" {...getContentTextProps(tag.name)}>
            {tag.name}
          </span>
        </button>
      ))}
    </div>
  )
}

function ActiveSearchChips({ chips, onRemove }) {
  if (!chips.length) {
    return null
  }

  return (
    <div className="recipe-search__terms" aria-label="Active search terms">
      {chips.map((chip) => (
        <button
          className="tag-chip tag-chip--active-filter"
          key={chip.key}
          onClick={() => onRemove(chip)}
          type="button"
        >
          <span className="content-text tag-chip__label" {...getContentTextProps(chip.label)}>
            {chip.label}
          </span>
          <span aria-hidden="true" className="tag-chip__dismiss">
            x
          </span>
        </button>
      ))}
    </div>
  )
}

function RecipeAttributes({ recipe }) {
  const details = []

  if (recipe.mealType) {
    details.push(mealTypeLabelByValue[recipe.mealType] || recipe.mealType)
  }

  if (recipe.cuisine) {
    details.push(recipe.cuisine)
  }

  if (recipe.totalTimeMinutes) {
    details.push(`${recipe.totalTimeMinutes} min`)
  }

  if (!details.length) {
    return null
  }

  return (
    <div className="recipe-card__attributes">
      {details.map((detail) => (
        <span className="recipe-card__attribute" key={detail}>
          {detail}
        </span>
      ))}
    </div>
  )
}

function RecipeActionMenu({ onDelete, onEdit, recipe }) {
  function closeMenu(event) {
    event.currentTarget.closest('details')?.removeAttribute('open')
  }

  function handleEditClick(event) {
    closeMenu(event)
    onEdit(recipe)
  }

  function handleDeleteClick(event) {
    closeMenu(event)
    onDelete(recipe)
  }

  return (
    <details className="recipe-card__menu">
      <summary aria-label={`More actions for ${recipe.title}`} className="ghost-button recipe-card__menu-trigger">
        More
      </summary>

      <div className="recipe-card__menu-popover">
        <button className="ghost-button recipe-card__menu-action" onClick={handleEditClick} type="button">
          Edit
        </button>
        <button
          className="ghost-button ghost-button--danger recipe-card__menu-action"
          onClick={handleDeleteClick}
          type="button"
        >
          Delete
        </button>
      </div>
    </details>
  )
}

export default function RecipeList({
  activeSearchChips,
  availableCuisines,
  availableTags,
  currentUserEmail,
  loading,
  onClearAllSearch,
  onDelete,
  onEdit,
  onQueryChange,
  onQueryClear,
  onRate,
  onSearchChipRemove,
  onSearchFieldChange,
  onSearchTagToggle,
  ratingRecipeId,
  recipes,
  searchState,
  tagsById,
  totalRecipesCount,
}) {
  const [tagFilterQuery, setTagFilterQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const hasRecipes = totalRecipesCount > 0
  const trimmedSearchQuery = searchState.query.trim()
  const effectiveSort = getEffectiveSearchSort(searchState)
  const selectedSearchTags = useMemo(
    () => availableTags.filter((tag) => searchState.selectedTagIds.includes(tag.id)),
    [availableTags, searchState.selectedTagIds],
  )
  const appliedFilterChips = useMemo(
    () => activeSearchChips.filter((chip) => chip.type !== 'query-term'),
    [activeSearchChips],
  )
  const hasStructuredFilters = appliedFilterChips.length > 0

  useEffect(() => {
    if (hasStructuredFilters) {
      setShowFilters(true)
    }
  }, [hasStructuredFilters])

  function handleClearAllClick() {
    setShowFilters(false)
    setTagFilterQuery('')
    onClearAllSearch()
  }

  function handleClearSearchClick() {
    onQueryClear()
  }

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
        <>
          <div className="recipe-search">
            <div className="recipe-search__bar">
              <label className="recipe-search__field" htmlFor="recipe-search">
                <span>Search recipes</span>
                <input
                  autoComplete="off"
                  className="content-input"
                  dir="auto"
                  id="recipe-search"
                  onChange={onQueryChange}
                  placeholder="Search titles, notes, tags, or links"
                  type="search"
                  value={searchState.query}
                />
              </label>

              <div className="recipe-search__controls">
                <button
                  className={`ghost-button${showFilters || hasStructuredFilters ? ' ghost-button--active' : ''}`}
                  onClick={() => setShowFilters((currentValue) => !currentValue)}
                  type="button"
                >
                  {showFilters ? 'Hide filters' : 'Filters'}
                </button>

                {trimmedSearchQuery ? (
                  <button className="ghost-button" onClick={onQueryClear} type="button">
                    Clear search
                  </button>
                ) : null}

                {hasStructuredFilters ? (
                  <button className="ghost-button" onClick={handleClearAllClick} type="button">
                    Clear all
                  </button>
                ) : null}
              </div>
            </div>

            {showFilters ? (
              <div className="recipe-search__filters">
                <ManagedTagAutocomplete
                  availableTags={availableTags}
                  emptyMessage="No shared tag matches this search."
                  inputId="recipe-tag-filter"
                  label="Tags"
                  onAddTag={(tag) => onSearchTagToggle(tag.id)}
                  onInputChange={setTagFilterQuery}
                  onRemoveTag={(tag) => onSearchTagToggle(tag.id)}
                  placeholder="Filter by tag"
                  query={tagFilterQuery}
                  selectedTags={selectedSearchTags}
                />

                <label className="field">
                  <span>Meal type</span>
                  <select
                    className="content-input"
                    onChange={(event) => onSearchFieldChange('mealType', event.target.value)}
                    value={searchState.mealType}
                  >
                    {MEAL_TYPE_OPTIONS.map((option) => (
                      <option key={option.value || 'any'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Cuisine</span>
                  <select
                    className="content-input"
                    onChange={(event) => onSearchFieldChange('cuisine', event.target.value)}
                    value={searchState.cuisine}
                  >
                    <option value="">Any cuisine</option>
                    {availableCuisines.map((cuisine) => (
                      <option key={cuisine} value={cuisine}>
                        {cuisine}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Max time</span>
                  <select
                    className="content-input"
                    onChange={(event) => onSearchFieldChange('maxTotalTimeMinutes', event.target.value)}
                    value={searchState.maxTotalTimeMinutes || ''}
                  >
                    <option value="">Any time</option>
                    {MAX_TOTAL_TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Min rating</span>
                  <select
                    className="content-input"
                    onChange={(event) => onSearchFieldChange('minimumRating', event.target.value)}
                    value={searchState.minimumRating || ''}
                  >
                    <option value="">Any rating</option>
                    {MINIMUM_RATING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Sort</span>
                  <select
                    className="content-input"
                    onChange={(event) => onSearchFieldChange('sort', event.target.value)}
                    value={effectiveSort}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {hasStructuredFilters ? (
              <ActiveSearchChips chips={appliedFilterChips} onRemove={onSearchChipRemove} />
            ) : null}
          </div>
        </>
      ) : null}

      {!hasRecipes ? (
        <p>
          Add the first recipe with a title and source URL. Everything else is optional.
        </p>
      ) : !recipes.length ? (
        <div className="recipe-empty-results">
          <p className="recipe-empty-results__title">
            No matches found
          </p>
          <p className="recipe-empty-results__copy">
            {hasStructuredFilters
              ? 'Try a different word or clear the filters.'
              : 'Try a different word or clear the current search.'}
          </p>
          <button
            className="ghost-button"
            onClick={hasStructuredFilters ? handleClearAllClick : handleClearSearchClick}
            type="button"
          >
            {hasStructuredFilters ? 'Clear filters' : 'Clear search'}
          </button>
        </div>
      ) : (
        <div className="recipe-list">
          {recipes.map((recipe) => {
            const sourceHost = getRecipeSourceHost(recipe.sourceUrl)
            const description = recipe.description || 'No description added.'
            const recipeTags = getResolvedRecipeTags(recipe, tagsById)

            return (
              <article className="recipe-card" key={recipe.id}>
                <RecipeImage recipe={recipe} />

                <div className="recipe-card__content">
                  <div className="recipe-card__body">
                    <div className="recipe-card__title-row">
                      <h3 className="recipe-card__title content-text" {...getContentTextProps(recipe.title)}>
                        {recipe.title}
                      </h3>
                      <p className="recipe-card__source" dir="ltr" title={recipe.sourceUrl}>
                        {sourceHost}
                      </p>
                    </div>

                    <p
                      className={`recipe-card__description content-text${recipe.description ? '' : ' recipe-card__description--muted'}`}
                      {...getContentTextProps(description)}
                    >
                      {description}
                    </p>
                  </div>

                  <RecipeAttributes recipe={recipe} />
                  <RecipeTags
                    activeTagIds={searchState.selectedTagIds}
                    onTagClick={onSearchTagToggle}
                    recipeTags={recipeTags}
                  />

                  <RecipeRating
                    currentUserEmail={currentUserEmail}
                    isSaving={ratingRecipeId === recipe.id}
                    onRate={onRate}
                    recipe={recipe}
                  />

                  <div className="recipe-card__meta">
                    <p className="recipe-card__date">{formatTimestamp(recipe.updatedAt)}</p>
                    <p className="recipe-card__added-by">{recipe.createdBy || 'Shared recipe'}</p>
                  </div>

                  <div className="recipe-card__footer">
                    <a
                      className="text-link"
                      href={recipe.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open recipe
                    </a>

                    <RecipeActionMenu onDelete={onDelete} onEdit={onEdit} recipe={recipe} />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
