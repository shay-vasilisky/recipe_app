import {
  FieldPath,
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db, firebaseConfigError } from '../lib/firebase'
import {
  normalizeComment,
  normalizeCommentCount,
  normalizeMealType,
  normalizeMultilineTextInput,
  normalizeRating,
  normalizeRecipe,
  normalizeTagIds,
  normalizeTextInput,
  normalizeTotalTimeMinutes,
  normalizeUserEmail,
} from '../lib/recipe-utils'

function ensureDb() {
  if (!db) {
    throw new Error(firebaseConfigError || 'Firestore is not configured.')
  }
}

const recipesCollection = () => collection(db, 'recipes')
const recipeDoc = (recipeId) => doc(db, 'recipes', recipeId)
const recipeCommentsCollection = (recipeId) => collection(db, 'recipes', recipeId, 'comments')
const recipeCommentDoc = (recipeId, commentId) => doc(db, 'recipes', recipeId, 'comments', commentId)

function buildRecipePayload(recipe) {
  return {
    title: normalizeTextInput(recipe.title),
    description: normalizeTextInput(recipe.description),
    sourceUrl: normalizeTextInput(recipe.sourceUrl),
    imageUrl: normalizeTextInput(recipe.imageUrl),
    tagIds: normalizeTagIds(recipe.tagIds),
    mealType: normalizeMealType(recipe.mealType),
    cuisine: normalizeTextInput(recipe.cuisine),
    totalTimeMinutes: normalizeTotalTimeMinutes(recipe.totalTimeMinutes),
  }
}

function buildCommentPayload(text, user) {
  const normalizedText = normalizeMultilineTextInput(text)
  const authorEmail = normalizeUserEmail(user?.email)
  const authorName = normalizeTextInput(user?.displayName) || authorEmail

  if (!normalizedText) {
    throw new Error('Comment text is required.')
  }

  if (!authorEmail) {
    throw new Error('You must be signed in to comment.')
  }

  return {
    text: normalizedText,
    authorEmail,
    authorName,
  }
}

export function subscribeToRecipes(onRecipes, onError) {
  ensureDb()

  const recipesQuery = query(recipesCollection(), orderBy('createdAt', 'desc'))

  return onSnapshot(
    recipesQuery,
    (snapshot) => {
      const recipes = snapshot.docs.map((recipeDoc) =>
        normalizeRecipe({
          id: recipeDoc.id,
          ...recipeDoc.data(),
        }),
      )

      onRecipes(recipes)
    },
    onError,
  )
}

export async function addRecipe(recipe, user) {
  ensureDb()

  return addDoc(recipesCollection(), {
    ...buildRecipePayload(recipe),
    commentCount: 0,
    ratings: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.email,
  })
}

export async function updateRecipe(recipeId, recipe) {
  ensureDb()

  return updateDoc(doc(db, 'recipes', recipeId), {
    ...buildRecipePayload(recipe),
    updatedAt: serverTimestamp(),
  })
}

export async function updateRecipeRating(recipeId, userEmail, rating) {
  ensureDb()

  const normalizedEmail = normalizeUserEmail(userEmail)
  const normalizedRating = normalizeRating(rating)

  if (!normalizedEmail) {
    throw new Error('User email is required to rate a recipe.')
  }

  if (normalizedRating === null) {
    throw new Error('Ratings must be between 1 and 5.')
  }

  return updateDoc(
    doc(db, 'recipes', recipeId),
    new FieldPath('ratings', normalizedEmail),
    normalizedRating,
    'updatedAt',
    serverTimestamp(),
  )
}

export function subscribeToRecipeComments(recipeId, onComments, onError) {
  ensureDb()

  const commentsQuery = query(recipeCommentsCollection(recipeId), orderBy('createdAt', 'asc'))

  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      const comments = snapshot.docs.map((commentDoc) =>
        normalizeComment({
          id: commentDoc.id,
          ...commentDoc.data(),
        }),
      )

      onComments(comments)
    },
    onError,
  )
}

export async function addRecipeComment(recipeId, text, user) {
  ensureDb()

  const commentPayload = buildCommentPayload(text, user)
  const batch = writeBatch(db)
  const newCommentRef = doc(recipeCommentsCollection(recipeId))

  batch.set(newCommentRef, {
    ...commentPayload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.update(recipeDoc(recipeId), {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return newCommentRef
}

export async function updateRecipeComment(recipeId, commentId, text) {
  ensureDb()

  const normalizedText = normalizeMultilineTextInput(text)

  if (!normalizedText) {
    throw new Error('Comment text is required.')
  }

  const batch = writeBatch(db)

  batch.update(recipeCommentDoc(recipeId, commentId), {
    text: normalizedText,
    updatedAt: serverTimestamp(),
  })
  batch.update(recipeDoc(recipeId), {
    updatedAt: serverTimestamp(),
  })

  return batch.commit()
}

export async function deleteRecipeComment(recipeId, commentId) {
  ensureDb()

  return runTransaction(db, async (transaction) => {
    const recipeRef = recipeDoc(recipeId)
    const commentRef = recipeCommentDoc(recipeId, commentId)
    const recipeSnapshot = await transaction.get(recipeRef)
    const commentSnapshot = await transaction.get(commentRef)

    if (!commentSnapshot.exists()) {
      throw new Error('Comment not found.')
    }

    transaction.delete(commentRef)
    transaction.update(recipeRef, {
      commentCount: Math.max(0, normalizeCommentCount(recipeSnapshot.data()?.commentCount) - 1),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function deleteRecipe(recipeId) {
  ensureDb()
  return deleteDoc(recipeDoc(recipeId))
}
