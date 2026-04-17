import {
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

function ensureDb() {
  if (!db) {
    throw new Error(firebaseConfigError || 'Firestore is not configured.')
  }
}

const recipesCollection = () => collection(db, 'recipes')

export function subscribeToRecipes(onRecipes, onError) {
  ensureDb()

  const recipesQuery = query(recipesCollection(), orderBy('createdAt', 'desc'))

  return onSnapshot(
    recipesQuery,
    (snapshot) => {
      const recipes = snapshot.docs.map((recipeDoc) => ({
        id: recipeDoc.id,
        ...recipeDoc.data(),
      }))

      onRecipes(recipes)
    },
    onError,
  )
}

export async function addRecipe(recipe, user) {
  ensureDb()

  return addDoc(recipesCollection(), {
    title: recipe.title.trim(),
    description: recipe.description.trim(),
    sourceUrl: recipe.sourceUrl.trim(),
    imageUrl: recipe.imageUrl.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.email,
  })
}

export async function updateRecipe(recipeId, recipe) {
  ensureDb()

  return updateDoc(doc(db, 'recipes', recipeId), {
    title: recipe.title.trim(),
    description: recipe.description.trim(),
    sourceUrl: recipe.sourceUrl.trim(),
    imageUrl: recipe.imageUrl.trim(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteRecipe(recipeId) {
  ensureDb()
  return deleteDoc(doc(db, 'recipes', recipeId))
}
