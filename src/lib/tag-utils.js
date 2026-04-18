import {
  normalizeSearchText,
  normalizeTagIds,
  normalizeTags,
  normalizeTextInput,
} from './recipe-utils'

export function normalizeTag(tag = {}) {
  const name = normalizeTextInput(tag.name)

  return {
    ...tag,
    name,
    normalizedName: normalizeSearchText(tag.normalizedName || name),
  }
}

export function getResolvedRecipeTags(recipe, tagsById = {}) {
  const resolvedTags = normalizeTagIds(recipe?.tagIds)
    .map((tagId) => {
      const tag = tagsById[tagId]

      if (!tag?.name) {
        return null
      }

      return {
        id: tag.id,
        name: tag.name,
      }
    })
    .filter(Boolean)

  if (resolvedTags.length) {
    return resolvedTags
  }

  return normalizeTags(recipe?.tags).map((tagName) => ({
    id: `legacy:${normalizeSearchText(tagName)}`,
    name: tagName,
  }))
}

export function collectMissingManagedTags(recipes, tags) {
  const knownTags = new Set(tags.map((tag) => normalizeSearchText(tag.normalizedName || tag.name)))
  const missingTags = new Map()

  recipes.forEach((recipe) => {
    normalizeTags(recipe.tags).forEach((tagName) => {
      const normalizedName = normalizeSearchText(tagName)

      if (!normalizedName || knownTags.has(normalizedName) || missingTags.has(normalizedName)) {
        return
      }

      missingTags.set(normalizedName, {
        name: tagName,
        normalizedName,
      })
    })
  })

  return Array.from(missingTags.values()).sort((left, right) =>
    left.normalizedName.localeCompare(right.normalizedName),
  )
}

export function buildRecipeTagMigrationUpdates(recipes, tags) {
  const tagIdByNormalizedName = new Map(
    tags.map((tag) => [normalizeSearchText(tag.normalizedName || tag.name), tag.id]),
  )

  return recipes.reduce((updates, recipe) => {
    const currentTagIds = normalizeTagIds(recipe.tagIds)
    const desiredTagIds = normalizeTagIds([
      ...currentTagIds,
      ...normalizeTags(recipe.tags)
        .map((tagName) => tagIdByNormalizedName.get(normalizeSearchText(tagName)))
        .filter(Boolean),
    ])

    const shouldClearLegacyTags = normalizeTags(recipe.tags).length > 0
    const tagIdsChanged =
      desiredTagIds.length !== currentTagIds.length ||
      desiredTagIds.some((tagId, index) => currentTagIds[index] !== tagId)

    if (!shouldClearLegacyTags && !tagIdsChanged) {
      return updates
    }

    updates.push({
      recipeId: recipe.id,
      tagIds: desiredTagIds,
      shouldClearLegacyTags,
    })

    return updates
  }, [])
}

export function getTagUsageCounts(recipes, tags) {
  const tagIdByNormalizedName = new Map(
    tags.map((tag) => [normalizeSearchText(tag.normalizedName || tag.name), tag.id]),
  )

  return recipes.reduce((counts, recipe) => {
    const recipeTagIds = new Set(normalizeTagIds(recipe.tagIds))

    normalizeTags(recipe.tags).forEach((tagName) => {
      const tagId = tagIdByNormalizedName.get(normalizeSearchText(tagName))

      if (tagId) {
        recipeTagIds.add(tagId)
      }
    })

    recipeTagIds.forEach((tagId) => {
      counts[tagId] = (counts[tagId] || 0) + 1
    })

    return counts
  }, {})
}
