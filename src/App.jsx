import { useEffect, useMemo, useRef, useState } from 'react'
import RecipeForm from './components/RecipeForm'
import RecipeList from './components/RecipeList'
import TagLibrary from './components/TagLibrary'
import { firebaseConfigError } from './lib/firebase'
import { normalizeUserEmail } from './lib/recipe-utils'
import {
  createEmptySearchState,
  getActiveSearchChips,
  getAvailableCuisines,
  getFilteredAndSortedRecipes,
  removeSearchTerm,
} from './lib/search-utils'
import { getTagUsageCounts } from './lib/tag-utils'
import {
  allowedEmailConfigError,
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
  updateRecipeRating,
} from './services/recipes'
import {
  createTag,
  deleteTagAndRemoveFromRecipes,
  renameTag,
  subscribeToTags,
  syncManagedTagsAndRecipes,
} from './services/tags'

const numericSearchFields = new Set(['maxTotalTimeMinutes', 'minimumRating'])
const mobileLayoutMediaQuery = '(max-width: 699px)'

function toggleSelectedTagIds(selectedTagIds, tagId) {
  return selectedTagIds.includes(tagId)
    ? selectedTagIds.filter((currentTagId) => currentTagId !== tagId)
    : [...selectedTagIds, tagId]
}

function parseSearchFieldValue(field, value) {
  if (!numericSearchFields.has(field)) {
    return value
  }

  if (!value) {
    return null
  }

  const parsedValue = Number.parseInt(value, 10)
  return Number.isInteger(parsedValue) ? parsedValue : null
}

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
  const [tags, setTags] = useState([])
  const [tagsLoading, setTagsLoading] = useState(true)
  const [tagsError, setTagsError] = useState('')
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [searchState, setSearchState] = useState(createEmptySearchState)
  const [ratingRecipeId, setRatingRecipeId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showTagLibrary, setShowTagLibrary] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(mobileLayoutMediaQuery).matches,
  )
  const [mobileSection, setMobileSection] = useState('recipes')
  const syncingManagedTagsRef = useRef(false)

  const setupError = firebaseConfigError || allowedEmailConfigError
  const canSignIn = !setupError
  const currentUserEmail = normalizeUserEmail(user?.email)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQueryList = window.matchMedia(mobileLayoutMediaQuery)
    const updateIsMobileLayout = (event) => {
      setIsMobileLayout(event.matches)
    }

    setIsMobileLayout(mediaQueryList.matches)

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', updateIsMobileLayout)

      return () => {
        mediaQueryList.removeEventListener('change', updateIsMobileLayout)
      }
    }

    mediaQueryList.addListener(updateIsMobileLayout)

    return () => {
      mediaQueryList.removeListener(updateIsMobileLayout)
    }
  }, [])

  useEffect(() => {
    if (firebaseConfigError) {
      setAuthReady(true)
      setRecipesLoading(false)
      setTagsLoading(false)
      return undefined
    }

    let cancelled = false

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
        setRecipesError('')
        setTags([])
        setTagsLoading(false)
        setTagsError('')
        setShowTagLibrary(false)
        setEditingRecipe(null)
        setSearchState(createEmptySearchState())
        setRatingRecipeId(null)
        setMobileSection('recipes')
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

  useEffect(() => {
    if (!user) {
      return undefined
    }

    setTagsLoading(true)
    setTagsError('')

    const unsubscribe = subscribeToTags(
      (nextTags) => {
        setTags(nextTags)
        setTagsLoading(false)
      },
      (error) => {
        setTagsError(error.message || 'Unable to load shared tags.')
        setTagsLoading(false)
      },
    )

    return unsubscribe
  }, [user])

  useEffect(() => {
    if (!user || recipesLoading || tagsLoading || !recipes.length || syncingManagedTagsRef.current) {
      return
    }

    let cancelled = false
    syncingManagedTagsRef.current = true

    async function syncManagedTags() {
      try {
        await syncManagedTagsAndRecipes(recipes, tags)

        if (!cancelled) {
          setTagsError('')
        }
      } catch (error) {
        if (!cancelled) {
          setTagsError(error.message || 'Unable to sync shared tags.')
        }
      } finally {
        syncingManagedTagsRef.current = false
      }
    }

    syncManagedTags()

    return () => {
      cancelled = true
    }
  }, [recipes, recipesLoading, tags, tagsLoading, user])

  useEffect(() => {
    if (!user || tagsLoading) {
      return
    }

    if (!tags.length || tagsError) {
      setShowTagLibrary(true)
    }
  }, [tags.length, tagsError, tagsLoading, user])

  const formInitialValues = useMemo(
    () =>
      editingRecipe
        ? {
            title: editingRecipe.title || '',
            description: editingRecipe.description || '',
            sourceUrl: editingRecipe.sourceUrl || '',
            imageUrl: editingRecipe.imageUrl || '',
            tagIds: editingRecipe.tagIds || [],
            mealType: editingRecipe.mealType || '',
            cuisine: editingRecipe.cuisine || '',
            totalTimeMinutes: editingRecipe.totalTimeMinutes,
          }
        : undefined,
    [editingRecipe],
  )

  const tagsById = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag])),
    [tags],
  )

  const filteredRecipes = useMemo(
    () => getFilteredAndSortedRecipes(recipes, tagsById, searchState),
    [recipes, searchState, tagsById],
  )

  const availableCuisines = useMemo(() => getAvailableCuisines(recipes), [recipes])
  const activeSearchChips = useMemo(
    () => getActiveSearchChips(searchState, tagsById),
    [searchState, tagsById],
  )
  const tagUsageCounts = useMemo(() => getTagUsageCounts(recipes, tags), [recipes, tags])

  async function handleSignIn() {
    setAuthMessage('')

    try {
      await signIn()
    } catch (error) {
      if (error.code === 'auth/popup-blocked') {
        setAuthMessage('The browser blocked the Google sign-in popup. Allow popups for this site and try again.')
        return
      }

      if (error.code === 'auth/cancelled-popup-request') {
        setAuthMessage('Another sign-in window is already open. Finish it or close it, then try again.')
        return
      }

      if (error.code === 'auth/popup-closed-by-user') {
        setAuthMessage('The Google sign-in window was closed before sign-in finished.')
        return
      }

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
      setMobileSection('recipes')
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
      setMobileSection('recipes')
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

  async function handleRateRecipe(recipe, rating) {
    if (!currentUserEmail) {
      return
    }

    setRatingRecipeId(recipe.id)
    setRecipesError('')

    try {
      await updateRecipeRating(recipe.id, currentUserEmail, rating)
    } catch (error) {
      setRecipesError(error.message || 'Unable to save rating.')
    } finally {
      setRatingRecipeId((currentRecipeId) => (currentRecipeId === recipe.id ? null : currentRecipeId))
    }
  }

  async function handleCreateTag(name) {
    setTagsError('')
    await createTag(name, tags)
  }

  async function handleRenameTag(tagId, name) {
    setTagsError('')
    await renameTag(tagId, name, tags)
  }

  async function handleDeleteTag(tagId) {
    setTagsError('')
    await deleteTagAndRemoveFromRecipes(tagId)
    setEditingRecipe((currentRecipe) =>
      currentRecipe
        ? {
            ...currentRecipe,
            tagIds: (currentRecipe.tagIds || []).filter((currentTagId) => currentTagId !== tagId),
          }
        : currentRecipe,
    )
    setSearchState((currentSearchState) => ({
      ...currentSearchState,
      selectedTagIds: currentSearchState.selectedTagIds.filter((currentTagId) => currentTagId !== tagId),
    }))
  }

  function handleEditRecipe(recipe) {
    setEditingRecipe(recipe)
    setMobileSection('recipe-form')
  }

  function handleCancelRecipeEdit() {
    setEditingRecipe(null)
    setMobileSection('recipes')
  }

  function handleTagLibraryToggle() {
    if (showTagLibrary) {
      setShowTagLibrary(false)

      if (mobileSection === 'admin') {
        setMobileSection('recipes')
      }

      return
    }

    setShowTagLibrary(true)
    setMobileSection('admin')
  }

  function handleQueryChange(event) {
    const { value } = event.target

    setSearchState((currentSearchState) => ({
      ...currentSearchState,
      query: value,
    }))
  }

  function handleQueryClear() {
    setSearchState((currentSearchState) => ({
      ...currentSearchState,
      query: '',
    }))
  }

  function handleClearAllSearch() {
    setSearchState(createEmptySearchState())
  }

  function handleSearchFieldChange(field, value) {
    setSearchState((currentSearchState) => ({
      ...currentSearchState,
      [field]: parseSearchFieldValue(field, value),
    }))
  }

  function handleSearchTagToggle(tagId) {
    setSearchState((currentSearchState) => ({
      ...currentSearchState,
      selectedTagIds: toggleSelectedTagIds(currentSearchState.selectedTagIds, tagId),
    }))
  }

  function handleSearchChipRemove(chip) {
    if (chip.type === 'query-term') {
      setSearchState((currentSearchState) => ({
        ...currentSearchState,
        query: removeSearchTerm(currentSearchState.query, chip.value),
      }))
      return
    }

    if (chip.type === 'tag') {
      handleSearchTagToggle(chip.value)
      return
    }

    if (chip.type === 'meal-type') {
      handleSearchFieldChange('mealType', '')
      return
    }

    if (chip.type === 'cuisine') {
      handleSearchFieldChange('cuisine', '')
      return
    }

    if (chip.type === 'max-time') {
      handleSearchFieldChange('maxTotalTimeMinutes', '')
      return
    }

    if (chip.type === 'minimum-rating') {
      handleSearchFieldChange('minimumRating', '')
      return
    }

    if (chip.type === 'sort') {
      handleSearchFieldChange('sort', '')
    }
  }

  const addSectionLabel = editingRecipe ? 'Edit' : 'Add'
  const showRecipesSection = !isMobileLayout || mobileSection === 'recipes'
  const showRecipeFormSection = !isMobileLayout || mobileSection === 'recipe-form'
  const shouldRenderTagLibrary = isMobileLayout || showTagLibrary
  const showAdminSection = !isMobileLayout ? showTagLibrary : mobileSection === 'admin'

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
    <div className={`app-shell${isMobileLayout ? ' app-shell--mobile' : ''}`}>
      <header className="topbar">
        <div className="topbar__branding">
          <p className="eyebrow">Shared cookbook</p>
          <h1>Recipe App</h1>
        </div>

        <div className="topbar__actions">
          <div className="user-chip">
            <span>{user.displayName || user.email}</span>
          </div>
          {!isMobileLayout ? (
            <button
              className={`ghost-button${showTagLibrary ? ' ghost-button--active' : ''}`}
              onClick={handleTagLibraryToggle}
              type="button"
            >
              {showTagLibrary ? 'Close tag manager' : 'Open tag manager'}
            </button>
          ) : null}
          <button className="ghost-button topbar__signout" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="layout__main" hidden={!showRecipesSection}>
          {recipesError ? <p className="inline-error">{recipesError}</p> : null}
          <RecipeList
            activeSearchChips={activeSearchChips}
            availableCuisines={availableCuisines}
            availableTags={tags}
            currentUser={user}
            currentUserEmail={currentUserEmail}
            isMobileLayout={isMobileLayout}
            loading={recipesLoading}
            onClearAllSearch={handleClearAllSearch}
            onDelete={handleDeleteRecipe}
            onEdit={handleEditRecipe}
            onQueryChange={handleQueryChange}
            onQueryClear={handleQueryClear}
            onRate={handleRateRecipe}
            onSearchChipRemove={handleSearchChipRemove}
            onSearchFieldChange={handleSearchFieldChange}
            onSearchTagToggle={handleSearchTagToggle}
            ratingRecipeId={ratingRecipeId}
            recipes={filteredRecipes}
            searchState={searchState}
            tagsById={tagsById}
            totalRecipesCount={recipes.length}
          />
        </div>

        <aside className="layout__sidebar" hidden={!showRecipeFormSection && !showAdminSection}>
          <div className="layout__sidebar-stack">
            {shouldRenderTagLibrary ? (
              <div hidden={!showAdminSection}>
                <TagLibrary
                  error={tagsError}
                  isMobileLayout={isMobileLayout}
                  loading={tagsLoading}
                  onCreateTag={handleCreateTag}
                  onDeleteTag={handleDeleteTag}
                  onRenameTag={handleRenameTag}
                  tags={tags}
                  usageCounts={tagUsageCounts}
                />
              </div>
            ) : null}

            <div hidden={!showRecipeFormSection}>
              <RecipeForm
                availableTags={tags}
                initialValues={formInitialValues}
                isMobileLayout={isMobileLayout}
                mode={editingRecipe ? 'edit' : 'add'}
                onCancel={handleCancelRecipeEdit}
                onSubmit={editingRecipe ? handleUpdateRecipe : handleAddRecipe}
                submitting={submitting}
              />
            </div>
          </div>
        </aside>
      </main>

      {isMobileLayout ? (
        <nav aria-label="Sections" className="mobile-tabbar">
          <button
            aria-pressed={mobileSection === 'recipes'}
            className={`mobile-tabbar__button${mobileSection === 'recipes' ? ' mobile-tabbar__button--active' : ''}`}
            onClick={() => setMobileSection('recipes')}
            type="button"
          >
            Recipes
          </button>
          <button
            aria-pressed={mobileSection === 'recipe-form'}
            className={`mobile-tabbar__button${mobileSection === 'recipe-form' ? ' mobile-tabbar__button--active' : ''}`}
            onClick={() => setMobileSection('recipe-form')}
            type="button"
          >
            {addSectionLabel}
          </button>
          <button
            aria-pressed={mobileSection === 'admin'}
            className={`mobile-tabbar__button${mobileSection === 'admin' ? ' mobile-tabbar__button--active' : ''}`}
            onClick={() => setMobileSection('admin')}
            type="button"
          >
            Tags
          </button>
        </nav>
      ) : null}
    </div>
  )
}
