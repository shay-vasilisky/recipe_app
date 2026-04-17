export function normalizeUserEmail(email = '') {
  return String(email).trim().toLowerCase()
}

export function normalizeTags(tags) {
  const source = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : []
  const seen = new Set()

  return source.reduce((normalizedTags, tag) => {
    const normalizedTag = String(tag).trim().toLowerCase()

    if (!normalizedTag || seen.has(normalizedTag)) {
      return normalizedTags
    }

    seen.add(normalizedTag)
    normalizedTags.push(normalizedTag)
    return normalizedTags
  }, [])
}

export function normalizeRating(value) {
  const rating = Number.parseInt(value, 10)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null
  }

  return rating
}

export function normalizeRatings(ratings) {
  if (!ratings || typeof ratings !== 'object') {
    return {}
  }

  return Object.entries(ratings).reduce((normalizedRatings, [email, value]) => {
    const normalizedEmail = normalizeUserEmail(email)
    const normalizedRating = normalizeRating(value)

    if (!normalizedEmail || normalizedRating === null) {
      return normalizedRatings
    }

    normalizedRatings[normalizedEmail] = normalizedRating
    return normalizedRatings
  }, {})
}

export function normalizeRecipe(recipe = {}) {
  return {
    ...recipe,
    tags: normalizeTags(recipe.tags),
    ratings: normalizeRatings(recipe.ratings),
  }
}

export function getRecipeSearchTerms(query = '') {
  return String(query)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

export function matchesRecipeSearch(recipe, query) {
  const searchTerms = Array.isArray(query) ? query : getRecipeSearchTerms(query)

  if (!searchTerms.length) {
    return true
  }

  const searchableFields = [
    recipe.title,
    recipe.description,
    recipe.sourceUrl,
    recipe.createdBy,
    ...normalizeTags(recipe.tags),
  ].map((value) => String(value || '').toLowerCase())

  return searchTerms.every((term) => searchableFields.some((field) => field.includes(term)))
}

export function appendSearchTerm(currentQuery, term) {
  const nextTerm = String(term).trim().toLowerCase()

  if (!nextTerm) {
    return String(currentQuery || '')
  }

  const currentTerms = getRecipeSearchTerms(currentQuery)

  if (currentTerms.includes(nextTerm)) {
    return currentTerms.join(' ')
  }

  return [...currentTerms, nextTerm].join(' ')
}

export function getRecipeRatingSummary(recipe, userEmail) {
  const ratings = normalizeRatings(recipe?.ratings)
  const ratingValues = Object.values(ratings)
  const currentUserRating = ratings[normalizeUserEmail(userEmail)] || 0

  if (!ratingValues.length) {
    return {
      averageRating: null,
      currentUserRating,
      ratingCount: 0,
    }
  }

  const total = ratingValues.reduce((sum, rating) => sum + rating, 0)

  return {
    averageRating: total / ratingValues.length,
    currentUserRating,
    ratingCount: ratingValues.length,
  }
}
