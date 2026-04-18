import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db, firebaseConfigError } from '../lib/firebase'
import { buildRecipeTagMigrationUpdates, collectMissingManagedTags, normalizeTag } from '../lib/tag-utils'

const MAX_BATCH_OPERATIONS = 400

function ensureDb() {
  if (!db) {
    throw new Error(firebaseConfigError || 'Firestore is not configured.')
  }
}

const tagsCollection = () => collection(db, 'tags')
const recipesCollection = () => collection(db, 'recipes')

function chunkItems(items, chunkSize = MAX_BATCH_OPERATIONS) {
  const chunks = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

function assertUniqueTagName(name, existingTags, currentTagId = null) {
  const normalizedTag = normalizeTag({ name })

  if (!normalizedTag.name) {
    throw new Error('Tag name is required.')
  }

  const duplicateTag = existingTags.find(
    (tag) => tag.id !== currentTagId && tag.normalizedName === normalizedTag.normalizedName,
  )

  if (duplicateTag) {
    throw new Error(`"${duplicateTag.name}" already exists.`)
  }

  return normalizedTag
}

export function subscribeToTags(onTags, onError) {
  ensureDb()

  const tagsQuery = query(tagsCollection(), orderBy('normalizedName', 'asc'))

  return onSnapshot(
    tagsQuery,
    (snapshot) => {
      const tags = snapshot.docs.map((tagDoc) =>
        normalizeTag({
          id: tagDoc.id,
          ...tagDoc.data(),
        }),
      )

      onTags(tags)
    },
    onError,
  )
}

export async function createTag(name, existingTags) {
  ensureDb()

  const normalizedTag = assertUniqueTagName(name, existingTags)

  return addDoc(tagsCollection(), {
    name: normalizedTag.name,
    normalizedName: normalizedTag.normalizedName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function renameTag(tagId, name, existingTags) {
  ensureDb()

  const normalizedTag = assertUniqueTagName(name, existingTags, tagId)

  return updateDoc(doc(db, 'tags', tagId), {
    name: normalizedTag.name,
    normalizedName: normalizedTag.normalizedName,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTagAndRemoveFromRecipes(tagId) {
  ensureDb()

  const taggedRecipes = await getDocs(query(recipesCollection(), where('tagIds', 'array-contains', tagId)))

  for (const taggedRecipeChunk of chunkItems(taggedRecipes.docs)) {
    const batch = writeBatch(db)

    taggedRecipeChunk.forEach((recipeDoc) => {
      const tagIds = Array.isArray(recipeDoc.data().tagIds) ? recipeDoc.data().tagIds : []

      batch.update(recipeDoc.ref, {
        tagIds: tagIds.filter((currentTagId) => currentTagId !== tagId),
        updatedAt: serverTimestamp(),
      })
    })

    await batch.commit()
  }

  return deleteDoc(doc(db, 'tags', tagId))
}

export async function syncManagedTagsAndRecipes(recipes, tags) {
  ensureDb()

  const missingTags = collectMissingManagedTags(recipes, tags)
  const createdTags = []

  for (const tagChunk of chunkItems(missingTags)) {
    const batch = writeBatch(db)

    tagChunk.forEach((tag) => {
      const tagRef = doc(tagsCollection())

      batch.set(tagRef, {
        name: tag.name,
        normalizedName: tag.normalizedName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      createdTags.push({
        id: tagRef.id,
        ...tag,
      })
    })

    await batch.commit()
  }

  const allTags = createdTags.length ? [...tags, ...createdTags] : tags
  const recipeUpdates = buildRecipeTagMigrationUpdates(recipes, allTags)

  for (const updateChunk of chunkItems(recipeUpdates)) {
    const batch = writeBatch(db)

    updateChunk.forEach((update) => {
      const payload = {
        tagIds: update.tagIds,
        updatedAt: serverTimestamp(),
      }

      if (update.shouldClearLegacyTags) {
        payload.tags = deleteField()
      }

      batch.update(doc(db, 'recipes', update.recipeId), payload)
    })

    await batch.commit()
  }
}
