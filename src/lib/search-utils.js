import {
  MEAL_TYPE_OPTIONS,
  getRecipeRatingSummary,
  getRecipeSourceHost,
  normalizeSearchText,
} from './recipe-utils'
import { getResolvedRecipeTags } from './tag-utils'

const FIELD_WEIGHTS = {
  title: 5,
  tag: 5,
  mealType: 4,
  cuisine: 4,
  description: 2,
  source: 1,
  createdBy: 1,
}

const MATCH_MULTIPLIERS = {
  exact: 3,
  prefix: 2,
  substring: 1,
}

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'rating_desc', label: 'Top rated' },
]

export const MAX_TOTAL_TIME_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
]

export const MINIMUM_RATING_OPTIONS = [
  { value: 1, label: '1+ stars' },
  { value: 2, label: '2+ stars' },
  { value: 3, label: '3+ stars' },
  { value: 4, label: '4+ stars' },
  { value: 5, label: '5 stars' },
]

export function createEmptySearchState() {
  return {
    query: '',
    selectedTagIds: [],
    mealType: '',
    cuisine: '',
    maxTotalTimeMinutes: null,
    minimumRating: null,
    sort: '',
  }
}

function splitSearchTerms(query = '') {
  return String(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function normalizeSearchTerm(term = '') {
  return normalizeSearchText(term)
}

export function getSearchTerms(query = '') {
  return splitSearchTerms(query)
    .map((term) => normalizeSearchTerm(term))
    .filter(Boolean)
}

export function getVisibleSearchTerms(query = '') {
  const seen = new Set()

  return splitSearchTerms(query).filter((term) => {
    const normalizedTerm = normalizeSearchTerm(term)

    if (!normalizedTerm || seen.has(normalizedTerm)) {
      return false
    }

    seen.add(normalizedTerm)
    return true
  })
}

export function removeSearchTerm(query, term) {
  const normalizedTerm = normalizeSearchTerm(term)

  if (!normalizedTerm) {
    return String(query || '')
  }

  return splitSearchTerms(query)
    .filter((currentTerm) => normalizeSearchTerm(currentTerm) !== normalizedTerm)
    .join(' ')
}

export function hasActiveSearch(searchState) {
  return Boolean(
    getSearchTerms(searchState.query).length ||
      searchState.selectedTagIds.length ||
      searchState.mealType ||
      searchState.cuisine ||
      searchState.maxTotalTimeMinutes ||
      searchState.minimumRating,
  )
}

export function getDefaultSearchSort(searchState) {
  return hasActiveSearch(searchState) ? 'relevance' : 'updated_desc'
}

export function getEffectiveSearchSort(searchState) {
  return searchState.sort || getDefaultSearchSort(searchState)
}

export function getAvailableCuisines(recipes) {
  const byNormalizedName = new Map()

  recipes.forEach((recipe) => {
    const normalizedCuisine = normalizeSearchText(recipe.cuisine)

    if (!normalizedCuisine || byNormalizedName.has(normalizedCuisine)) {
      return
    }

    byNormalizedName.set(normalizedCuisine, recipe.cuisine)
  })

  return Array.from(byNormalizedName.values()).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' }),
  )
}

function getSearchFieldEntries(recipe, tagsById) {
  return [
    { value: recipe.title, weight: FIELD_WEIGHTS.title },
    ...getResolvedRecipeTags(recipe, tagsById).map((tag) => ({
      value: tag.name,
      weight: FIELD_WEIGHTS.tag,
    })),
    { value: recipe.mealType, weight: FIELD_WEIGHTS.mealType },
    { value: recipe.cuisine, weight: FIELD_WEIGHTS.cuisine },
    { value: recipe.description, weight: FIELD_WEIGHTS.description },
    { value: getRecipeSourceHost(recipe.sourceUrl), weight: FIELD_WEIGHTS.source },
    { value: recipe.createdBy, weight: FIELD_WEIGHTS.createdBy },
  ]
    .map((entry) => ({
      ...entry,
      normalizedValue: normalizeSearchText(entry.value),
    }))
    .filter((entry) => entry.normalizedValue)
}

function getMatchMultiplier(value, term) {
  if (!value || !term) {
    return 0
  }

  if (value === term) {
    return MATCH_MULTIPLIERS.exact
  }

  const tokens = value.split(/\s+/)

  if (value.startsWith(term) || tokens.some((token) => token.startsWith(term))) {
    return MATCH_MULTIPLIERS.prefix
  }

  if (value.includes(term)) {
    return MATCH_MULTIPLIERS.substring
  }

  return 0
}

function getRecipeSearchScore(recipe, tagsById, searchTerms) {
  if (!searchTerms.length) {
    return 0
  }

  const fieldEntries = getSearchFieldEntries(recipe, tagsById)
  let totalScore = 0

  for (const term of searchTerms) {
    let bestScore = 0

    fieldEntries.forEach((entry) => {
      const matchMultiplier = getMatchMultiplier(entry.normalizedValue, term)

      if (!matchMultiplier) {
        return
      }

      bestScore = Math.max(bestScore, entry.weight * matchMultiplier)
    })

    if (!bestScore) {
      return null
    }

    totalScore += bestScore
  }

  return totalScore
}

function matchesStructuredFilters(recipe, searchState) {
  if (searchState.mealType && recipe.mealType !== searchState.mealType) {
    return false
  }

  if (
    searchState.cuisine &&
    normalizeSearchText(recipe.cuisine) !== normalizeSearchText(searchState.cuisine)
  ) {
    return false
  }

  if (
    searchState.maxTotalTimeMinutes &&
    (!recipe.totalTimeMinutes || recipe.totalTimeMinutes > searchState.maxTotalTimeMinutes)
  ) {
    return false
  }

  const recipeTagIds = new Set(recipe.tagIds || [])

  if (searchState.selectedTagIds.some((tagId) => !recipeTagIds.has(tagId))) {
    return false
  }

  if (searchState.minimumRating) {
    const { averageRating } = getRecipeRatingSummary(recipe)

    if (averageRating === null || averageRating < searchState.minimumRating) {
      return false
    }
  }

  return true
}

function getTimestampValue(timestamp) {
  if (!timestamp?.toMillis) {
    return 0
  }

  return timestamp.toMillis()
}

export function getFilteredAndSortedRecipes(recipes, tagsById, searchState) {
  const searchTerms = getSearchTerms(searchState.query)

  const rankedRecipes = recipes.reduce((results, recipe) => {
    if (!matchesStructuredFilters(recipe, searchState)) {
      return results
    }

    const score = getRecipeSearchScore(recipe, tagsById, searchTerms)

    if (searchTerms.length && score === null) {
      return results
    }

    const { averageRating } = getRecipeRatingSummary(recipe)

    results.push({
      recipe,
      score: score || 0,
      averageRating: averageRating || 0,
      updatedAt: getTimestampValue(recipe.updatedAt),
    })

    return results
  }, [])

  const sort = getEffectiveSearchSort(searchState)

  rankedRecipes.sort((left, right) => {
    if (sort === 'rating_desc') {
      if (right.averageRating !== left.averageRating) {
        return right.averageRating - left.averageRating
      }

      return right.updatedAt - left.updatedAt
    }

    if (sort === 'updated_desc') {
      if (right.updatedAt !== left.updatedAt) {
        return right.updatedAt - left.updatedAt
      }

      return right.averageRating - left.averageRating
    }

    if (right.score !== left.score) {
      return right.score - left.score
    }

    if (right.averageRating !== left.averageRating) {
      return right.averageRating - left.averageRating
    }

    return right.updatedAt - left.updatedAt
  })

  return rankedRecipes.map((entry) => entry.recipe)
}

export function getActiveSearchChips(searchState, tagsById) {
  const chips = getVisibleSearchTerms(searchState.query).map((term) => ({
    key: `term:${normalizeSearchTerm(term)}`,
    label: term,
    type: 'query-term',
    value: term,
  }))

  searchState.selectedTagIds.forEach((tagId) => {
    const tag = tagsById[tagId]

    if (!tag?.name) {
      return
    }

    chips.push({
      key: `tag:${tagId}`,
      label: tag.name,
      type: 'tag',
      value: tagId,
    })
  })

  if (searchState.mealType) {
    const mealTypeLabel =
      MEAL_TYPE_OPTIONS.find((option) => option.value === searchState.mealType)?.label ||
      searchState.mealType

    chips.push({
      key: `meal:${searchState.mealType}`,
      label: mealTypeLabel,
      type: 'meal-type',
      value: searchState.mealType,
    })
  }

  if (searchState.cuisine) {
    chips.push({
      key: `cuisine:${normalizeSearchText(searchState.cuisine)}`,
      label: searchState.cuisine,
      type: 'cuisine',
      value: searchState.cuisine,
    })
  }

  if (searchState.maxTotalTimeMinutes) {
    chips.push({
      key: `time:${searchState.maxTotalTimeMinutes}`,
      label: `${searchState.maxTotalTimeMinutes} min or less`,
      type: 'max-time',
      value: searchState.maxTotalTimeMinutes,
    })
  }

  if (searchState.minimumRating) {
    chips.push({
      key: `rating:${searchState.minimumRating}`,
      label: `${searchState.minimumRating}+ stars`,
      type: 'minimum-rating',
      value: searchState.minimumRating,
    })
  }

  const defaultSort = getDefaultSearchSort(searchState)
  const effectiveSort = getEffectiveSearchSort(searchState)

  if (searchState.sort && effectiveSort !== defaultSort) {
    chips.push({
      key: `sort:${effectiveSort}`,
      label: SORT_OPTIONS.find((option) => option.value === effectiveSort)?.label || effectiveSort,
      type: 'sort',
      value: effectiveSort,
    })
  }

  return chips
}
