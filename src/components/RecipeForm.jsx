import { useEffect, useState } from 'react'
import { normalizeTags } from '../lib/recipe-utils'

const emptyForm = {
  title: '',
  description: '',
  sourceUrl: '',
  imageUrl: '',
  tags: [],
}

function getFormValues(initialValues = emptyForm) {
  return {
    title: initialValues.title || '',
    description: initialValues.description || '',
    sourceUrl: initialValues.sourceUrl || '',
    imageUrl: initialValues.imageUrl || '',
    tags: Array.isArray(initialValues.tags) ? initialValues.tags : [],
  }
}

export default function RecipeForm({
  mode,
  initialValues = emptyForm,
  onSubmit,
  onCancel,
  submitting,
}) {
  const [values, setValues] = useState(() => getFormValues(initialValues))
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setValues(getFormValues(initialValues))
    setTagInput('')
    setError('')
  }, [initialValues])

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function commitTagInput() {
    const nextTags = normalizeTags(tagInput.split(','))

    if (!nextTags.length) {
      setTagInput('')
      return
    }

    setValues((current) => ({
      ...current,
      tags: normalizeTags([...current.tags, ...nextTags]),
    }))
    setTagInput('')
  }

  function removeTag(tagToRemove) {
    setValues((current) => ({
      ...current,
      tags: current.tags.filter((tag) => tag !== tagToRemove),
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
      await onSubmit({
        ...values,
        tags: normalizeTags([...values.tags, ...tagInput.split(',')]),
      })

      if (mode === 'add') {
        setValues(emptyForm)
        setTagInput('')
      }
    } catch (submitError) {
      setError(submitError.message || 'Unable to save recipe.')
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{mode === 'add' ? 'New recipe' : 'Edit recipe'}</p>
          <h2>{mode === 'add' ? 'Add a recipe' : 'Update recipe'}</h2>
        </div>
        {mode === 'edit' ? (
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
            name="title"
            onChange={updateField}
            placeholder="Shakshuka"
            type="text"
            value={values.title}
          />
        </label>

        <label className="field">
          <span>Description</span>
          <textarea
            name="description"
            onChange={updateField}
            placeholder="Simple notes for why you saved it."
            rows="4"
            value={values.description}
          />
        </label>

        <label className="field">
          <span>Source URL</span>
          <input
            autoComplete="off"
            name="sourceUrl"
            onChange={updateField}
            placeholder="https://example.com/recipe"
            type="url"
            value={values.sourceUrl}
          />
        </label>

        <label className="field">
          <span>Image URL</span>
          <input
            autoComplete="off"
            name="imageUrl"
            onChange={updateField}
            placeholder="https://example.com/photo.jpg"
            type="url"
            value={values.imageUrl}
          />
        </label>

        <div className="field">
          <label htmlFor="recipe-tags">
            <span>Tags</span>
          </label>
          <div className="tag-editor">
            {values.tags.length ? (
              <div className="tag-editor__list">
                {values.tags.map((tag) => (
                  <button
                    className="tag-chip tag-chip--editable"
                    key={tag}
                    onClick={() => removeTag(tag)}
                    type="button"
                  >
                    <span>{tag}</span>
                    <span aria-hidden="true">x</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="tag-editor__controls">
              <input
                autoComplete="off"
                id="recipe-tags"
                onBlur={commitTagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault()
                    commitTagInput()
                  }
                }}
                placeholder="vegetarian, quick dinner"
                type="text"
                value={tagInput}
              />
              <button className="ghost-button" onClick={commitTagInput} type="button">
                Add tag
              </button>
            </div>
          </div>
          <p className="field__hint">Press Enter or comma to add a tag. Click a tag to remove it.</p>
        </div>

        {error ? <p className="inline-error">{error}</p> : null}

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? 'Saving…' : mode === 'add' ? 'Add recipe' : 'Save changes'}
        </button>
      </form>
    </section>
  )
}
