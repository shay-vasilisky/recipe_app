import { useEffect, useMemo, useState } from 'react'
import RecipeForm from './components/RecipeForm'
import RecipeList from './components/RecipeList'
import { firebaseConfigError } from './lib/firebase'
import {
  allowedEmailConfigError,
  completeRedirectSignIn,
  isUserAllowed,
  observeAuthState,
  signIn,
  signOutUser,
} from './services/auth'
import {
  addRecipe,
  deleteRecipe,
  subscribeToRecipes,
  updateRecipe,
} from './services/recipes'

function SetupNotice({ title, body }) {
  return (
    <section className="setup-notice">
      <p className="eyebrow">Setup</p>
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  )
}

function LoginScreen({ authMessage, canSignIn, onSignIn }) {
  return (
    <main className="login-screen">
      <section className="hero">
        <p className="eyebrow">Recipe App</p>
        <h1>A shared list for recipes you actually want to cook again.</h1>
        <p className="hero__copy">
          Save a title, short description, source URL, and optional image. Both approved
          accounts see the same list.
        </p>

        <div className="hero__actions">
          <button className="primary-button primary-button--large" disabled={!canSignIn} onClick={onSignIn} type="button">
            Sign in with Google
          </button>
        </div>

        {authMessage ? <p className="inline-error hero__error">{authMessage}</p> : null}
      </section>
    </main>
  )
}

export default function App() {
  const [authReady, setAuthReady] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [user, setUser] = useState(null)
  const [recipes, setRecipes] = useState([])
  const [recipesLoading, setRecipesLoading] = useState(true)
  const [recipesError, setRecipesError] = useState('')
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setupError = firebaseConfigError || allowedEmailConfigError
  const canSignIn = !setupError

  useEffect(() => {
    if (firebaseConfigError) {
      setAuthReady(true)
      setRecipesLoading(false)
      return undefined
    }

    let cancelled = false

    completeRedirectSignIn().catch((error) => {
      if (!cancelled) {
        setAuthMessage(error.message || 'Google sign-in failed.')
      }
    })

    const unsubscribe = observeAuthState(async (nextUser) => {
      if (cancelled) {
        return
      }

      if (nextUser && !isUserAllowed(nextUser)) {
        setAuthMessage(`Signed in as ${nextUser.email}. This app only allows the two approved Google accounts.`)
        await signOutUser()
        setUser(null)
        setAuthReady(true)
        return
      }

      setUser(nextUser)
      setAuthReady(true)
      if (!nextUser) {
        setRecipes([])
        setRecipesLoading(false)
        setEditingRecipe(null)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      return undefined
    }

    setRecipesLoading(true)
    setRecipesError('')

    const unsubscribe = subscribeToRecipes(
      (nextRecipes) => {
        setRecipes(nextRecipes)
        setRecipesLoading(false)
      },
      (error) => {
        setRecipesError(error.message || 'Unable to load recipes.')
        setRecipesLoading(false)
      },
    )

    return unsubscribe
  }, [user])

  const formInitialValues = useMemo(
    () =>
      editingRecipe
        ? {
            title: editingRecipe.title || '',
            description: editingRecipe.description || '',
            sourceUrl: editingRecipe.sourceUrl || '',
            imageUrl: editingRecipe.imageUrl || '',
          }
        : undefined,
    [editingRecipe],
  )

  async function handleSignIn() {
    setAuthMessage('')

    try {
      await signIn()
    } catch (error) {
      setAuthMessage(error.message || 'Unable to start Google sign-in.')
    }
  }

  async function handleSignOut() {
    try {
      await signOutUser()
      setAuthMessage('')
    } catch (error) {
      setAuthMessage(error.message || 'Unable to sign out.')
    }
  }

  async function handleAddRecipe(values) {
    if (!user) {
      return
    }

    setSubmitting(true)
    setRecipesError('')

    try {
      await addRecipe(values, user)
    } catch (error) {
      setRecipesError(error.message || 'Unable to add recipe.')
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateRecipe(values) {
    if (!editingRecipe) {
      return
    }

    setSubmitting(true)
    setRecipesError('')

    try {
      await updateRecipe(editingRecipe.id, values)
      setEditingRecipe(null)
    } catch (error) {
      setRecipesError(error.message || 'Unable to update recipe.')
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteRecipe(recipe) {
    const confirmed = window.confirm(`Delete "${recipe.title}"?`)

    if (!confirmed) {
      return
    }

    setRecipesError('')

    try {
      await deleteRecipe(recipe.id)
      if (editingRecipe?.id === recipe.id) {
        setEditingRecipe(null)
      }
    } catch (error) {
      setRecipesError(error.message || 'Unable to delete recipe.')
    }
  }

  function openRecipe(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!authReady) {
    return (
      <main className="loading-screen">
        <p>Loading Recipe App…</p>
      </main>
    )
  }

  if (!user) {
    return (
      <>
        <LoginScreen authMessage={authMessage || setupError} canSignIn={canSignIn} onSignIn={handleSignIn} />
        {firebaseConfigError ? (
          <SetupNotice
            body="Copy .env.example to .env.local and fill in your Firebase web app config."
            title="Firebase config is missing"
          />
        ) : null}
        {allowedEmailConfigError ? (
          <SetupNotice
            body="Set VITE_ALLOWED_EMAILS with the two Google accounts that should access the app."
            title="Allowed email list is missing"
          />
        ) : null}
      </>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Shared cookbook</p>
          <h1>Recipe App</h1>
        </div>

        <div className="topbar__actions">
          <div className="user-chip">
            <span>{user.displayName || user.email}</span>
          </div>
          <button className="ghost-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="layout__main">
          {recipesError ? <p className="inline-error">{recipesError}</p> : null}
          <RecipeList
            loading={recipesLoading}
            onDelete={handleDeleteRecipe}
            onEdit={setEditingRecipe}
            onOpen={openRecipe}
            recipes={recipes}
          />
        </div>

        <aside className="layout__sidebar">
          <RecipeForm
            initialValues={formInitialValues}
            mode={editingRecipe ? 'edit' : 'add'}
            onCancel={() => setEditingRecipe(null)}
            onSubmit={editingRecipe ? handleUpdateRecipe : handleAddRecipe}
            submitting={submitting}
          />
        </aside>
      </main>
    </div>
  )
}
