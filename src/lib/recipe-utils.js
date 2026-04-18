export const MEAL_TYPE_OPTIONS = [
  { value: '', label: 'Any meal' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'snack', label: 'Snack' },
  { value: 'drink', label: 'Drink' },
  { value: 'other', label: 'Other' },
]

const allowedMealTypes = new Set(MEAL_TYPE_OPTIONS.map((option) => option.value))

export function normalizeUserEmail(email = '') {
  return String(email).trim().toLowerCase()
}

export function normalizeTextInput(value = '') {
  return String(value).trim().replace(/\s+/g, ' ')
}

export function normalizeMultilineTextInput(value = '') {
  return String(value)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/[^\S\n]+/g, ' '))
    .join('\n')
    .trim()
}

export function normalizeSearchText(value = '') {
  return normalizeTextInput(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeTagValue(tag = '') {
  return normalizeSearchText(tag)
}

export function normalizeTags(tags) {
  const source = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : []
  const seen = new Set()

  return source.reduce((normalizedTags, tag) => {
    const displayTag = normalizeTextInput(tag)
    const normalizedTag = normalizeTagValue(displayTag)

    if (!normalizedTag || seen.has(normalizedTag)) {
      return normalizedTags
    }

    seen.add(normalizedTag)
    normalizedTags.push(displayTag)
    return normalizedTags
  }, [])
}

export function normalizeTagIds(tagIds) {
  const source = Array.isArray(tagIds) ? tagIds : []
  const seen = new Set()

  return source.reduce((normalizedTagIds, tagId) => {
    const value = String(tagId || '').trim()

    if (!value || seen.has(value)) {
      return normalizedTagIds
    }

    seen.add(value)
    normalizedTagIds.push(value)
    return normalizedTagIds
  }, [])
}

export function normalizeMealType(value = '') {
  const normalizedValue = normalizeSearchText(value)
  return allowedMealTypes.has(normalizedValue) ? normalizedValue : ''
}

export function normalizeTotalTimeMinutes(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const totalTimeMinutes = Number.parseInt(value, 10)

  if (!Number.isInteger(totalTimeMinutes) || totalTimeMinutes <= 0) {
    return null
  }

  return totalTimeMinutes
}

export function normalizeRating(value) {
  const rating = Number.parseInt(value, 10)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null
  }

  return rating
}

export function normalizeCommentCount(value) {
  const commentCount = Number.parseInt(value, 10)
  return Number.isInteger(commentCount) && commentCount >= 0 ? commentCount : 0
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

export function normalizeComment(comment = {}) {
  return {
    ...comment,
    text: normalizeMultilineTextInput(comment.text),
    authorEmail: normalizeUserEmail(comment.authorEmail),
    authorName: normalizeTextInput(comment.authorName),
  }
}

export function normalizeRecipe(recipe = {}) {
  return {
    ...recipe,
    title: normalizeTextInput(recipe.title),
    description: normalizeTextInput(recipe.description),
    sourceUrl: normalizeTextInput(recipe.sourceUrl),
    imageUrl: normalizeTextInput(recipe.imageUrl),
    createdBy: normalizeTextInput(recipe.createdBy),
    tags: normalizeTags(recipe.tags),
    tagIds: normalizeTagIds(recipe.tagIds),
    mealType: normalizeMealType(recipe.mealType),
    cuisine: normalizeTextInput(recipe.cuisine),
    totalTimeMinutes: normalizeTotalTimeMinutes(recipe.totalTimeMinutes),
    commentCount: normalizeCommentCount(recipe.commentCount),
    ratings: normalizeRatings(recipe.ratings),
  }
}

export function getRecipeSourceHost(url = '') {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.hostname.replace(/^www\./i, '') || 'Recipe link'
  } catch {
    return 'Recipe link'
  }
}

export function getContentTextProps(text = '') {
  const value = String(text).trim()
  const hasHebrewCharacters = /[\u0590-\u05FF]/.test(value)

  return {
    dir: 'auto',
    lang: value ? (hasHebrewCharacters ? 'he' : 'en') : undefined,
  }
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
