import {
  FieldPath,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db, firebaseConfigError } from '../lib/firebase'
import {
  normalizeMealType,
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

export async function deleteRecipe(recipeId) {
  ensureDb()
  return deleteDoc(doc(db, 'recipes', recipeId))
}
