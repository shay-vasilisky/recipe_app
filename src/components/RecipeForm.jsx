import { useEffect, useMemo, useRef, useState } from 'react'
import ManagedTagAutocomplete from './ManagedTagAutocomplete'
import { MEAL_TYPE_OPTIONS } from '../lib/recipe-utils'

const emptyForm = {
  title: '',
  description: '',
  sourceUrl: '',
  imageUrl: '',
  tagIds: [],
  mealType: '',
  cuisine: '',
  totalTimeMinutes: '',
}

function getFormValues(initialValues = emptyForm) {
  return {
    title: initialValues.title || '',
    description: initialValues.description || '',
    sourceUrl: initialValues.sourceUrl || '',
    imageUrl: initialValues.imageUrl || '',
    tagIds: Array.isArray(initialValues.tagIds) ? initialValues.tagIds : [],
    mealType: initialValues.mealType || '',
    cuisine: initialValues.cuisine || '',
    totalTimeMinutes:
      initialValues.totalTimeMinutes === null || initialValues.totalTimeMinutes === undefined
        ? ''
        : String(initialValues.totalTimeMinutes),
  }
}

function hasAdditionalDetails(values = emptyForm) {
  return Boolean(
    (values.description && String(values.description).trim()) ||
      (values.imageUrl && String(values.imageUrl).trim()) ||
      (Array.isArray(values.tagIds) && values.tagIds.length) ||
      (values.mealType && String(values.mealType).trim()) ||
      (values.cuisine && String(values.cuisine).trim()) ||
      values.totalTimeMinutes,
  )
}

export default function RecipeForm({
  availableTags,
  initialValues = emptyForm,
  isMobileLayout,
  mode,
  onCancel,
  onSubmit,
  submitting,
}) {
  const [values, setValues] = useState(() => getFormValues(initialValues))
  const [tagQuery, setTagQuery] = useState('')
  const [error, setError] = useState('')
  const [showDetails, setShowDetails] = useState(() => mode === 'edit' || hasAdditionalDetails(initialValues))
  const sectionRef = useRef(null)

  useEffect(() => {
    setValues(getFormValues(initialValues))
    setTagQuery('')
    setError('')
    setShowDetails(mode === 'edit' || hasAdditionalDetails(initialValues))
  }, [initialValues, mode])

  useEffect(() => {
    if (mode !== 'edit' || !isMobileLayout || typeof window === 'undefined') {
      return
    }

    sectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [initialValues, isMobileLayout, mode])

  const selectedTags = useMemo(
    () => availableTags.filter((tag) => values.tagIds.includes(tag.id)),
    [availableTags, values.tagIds],
  )

  const isMobileQuickAdd = isMobileLayout && mode === 'add'
  const showExpandedEditLayout = isMobileLayout && mode === 'edit'
  const tagEmptyMessage = availableTags.length
    ? 'No shared tag matches this search.'
    : 'No shared tags yet. Open the tag manager to add the first one.'
  const tagHelperText = availableTags.length
    ? 'Shared tags are optional. Click a selected tag to remove it.'
    : 'No shared tags yet. Open the tag manager to add the first one.'
  const submitLabel = mode === 'add' ? 'Add recipe' : 'Save changes'

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function addTag(tag) {
    setValues((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tag.id) ? current.tagIds : [...current.tagIds, tag.id],
    }))
  }

  function removeTag(tagToRemove) {
    setValues((current) => ({
      ...current,
      tagIds: current.tagIds.filter((tagId) => tagId !== tagToRemove.id),
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!values.title.trim() || !values.sourceUrl.trim()) {
      setError('Title and source URL are required.')
      return
    }

    try {
      await onSubmit(values)

      if (mode === 'add') {
        setValues(emptyForm)
        setTagQuery('')
        setShowDetails(false)
      }
    } catch (submitError) {
      setError(submitError.message || 'Unable to save recipe.')
    }
  }

  const summaryFields = (
    <>
      <label className="field">
        <span>Description</span>
        <textarea
          className="content-input"
          dir="auto"
          name="description"
          onChange={updateField}
          placeholder="Short summary for why you saved it."
          rows="4"
          value={values.description}
        />
      </label>

      <label className="field">
        <span>Image URL</span>
        <input
          autoComplete="off"
          className="content-input"
          inputMode="url"
          name="imageUrl"
          onChange={updateField}
          placeholder="https://example.com/photo.jpg"
          type="url"
          value={values.imageUrl}
        />
      </label>
    </>
  )

  const detailFields = (
    <>
      <div className="recipe-form__grid">
        <label className="field">
          <span>Meal type</span>
          <select className="content-input" name="mealType" onChange={updateField} value={values.mealType}>
            {MEAL_TYPE_OPTIONS.map((option) => (
              <option key={option.value || 'any'} value={option.value}>
                {option.value ? option.label : 'Choose a meal type'}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Total time (minutes)</span>
          <input
            autoComplete="off"
            className="content-input"
            inputMode="numeric"
            min="1"
            name="totalTimeMinutes"
            onChange={updateField}
            placeholder="30"
            type="number"
            value={values.totalTimeMinutes}
          />
        </label>
      </div>

      <label className="field">
        <span>Cuisine</span>
        <input
          autoComplete="off"
          className="content-input"
          dir="auto"
          name="cuisine"
          onChange={updateField}
          placeholder="Middle Eastern"
          type="text"
          value={values.cuisine}
        />
      </label>

      <ManagedTagAutocomplete
        availableTags={availableTags}
        emptyMessage={tagEmptyMessage}
        helperText={tagHelperText}
        inputId="recipe-tags"
        label="Tags"
        onAddTag={addTag}
        onInputChange={setTagQuery}
        onRemoveTag={removeTag}
        placeholder="Search shared tags"
        query={tagQuery}
        selectedTags={selectedTags}
      />
    </>
  )

  return (
    <section className={`panel${isMobileLayout ? ' panel--mobile-form' : ''}`} ref={sectionRef}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">{mode === 'add' ? 'New recipe' : 'Edit recipe'}</p>
          <h2>{mode === 'add' ? 'Add a recipe' : 'Update recipe'}</h2>
        </div>
        {mode === 'edit' && !isMobileLayout ? (
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>

      <form className="recipe-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Title</span>
          <input
            autoComplete="off"
            className="content-input"
            dir="auto"
            enterKeyHint={isMobileLayout ? 'next' : undefined}
            name="title"
            onChange={updateField}
            placeholder="Shakshuka"
            type="text"
            value={values.title}
          />
        </label>

        <label className="field">
          <span>Source URL</span>
          <input
            autoComplete="off"
            className="content-input"
            enterKeyHint={isMobileLayout ? 'done' : undefined}
            inputMode="url"
            name="sourceUrl"
            onChange={updateField}
            placeholder="https://example.com/recipe"
            type="url"
            value={values.sourceUrl}
          />
        </label>

        {isMobileQuickAdd ? (
          <div className="recipe-form__details">
            <button
              aria-expanded={showDetails}
              className="ghost-button recipe-form__details-toggle"
              onClick={() => setShowDetails((currentValue) => !currentValue)}
              type="button"
            >
              {showDetails ? 'Hide more details' : 'More details'}
            </button>

            {showDetails ? (
              <div className="recipe-form__details-body">
                {summaryFields}
                {detailFields}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {summaryFields}

            {showExpandedEditLayout ? (
              <div className="recipe-form__details-body">{detailFields}</div>
            ) : (
              <div className="recipe-form__details">
                <button
                  aria-expanded={showDetails}
                  className="ghost-button recipe-form__details-toggle"
                  onClick={() => setShowDetails((currentValue) => !currentValue)}
                  type="button"
                >
                  {showDetails ? 'Hide more details' : 'More details'}
                </button>

                {showDetails ? <div className="recipe-form__details-body">{detailFields}</div> : null}
              </div>
            )}
          </>
        )}

        {error ? <p className="inline-error">{error}</p> : null}

        <div className={`recipe-form__actions${isMobileLayout ? ' recipe-form__actions--sticky' : ''}`}>
          {mode === 'edit' && isMobileLayout ? (
            <button className="ghost-button" disabled={submitting} onClick={onCancel} type="button">
              Cancel
            </button>
          ) : null}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </section>
  )
}
