import { useEffect, useState } from 'react'

const emptyForm = {
  title: '',
  description: '',
  sourceUrl: '',
  imageUrl: '',
}

export default function RecipeForm({
  mode,
  initialValues = emptyForm,
  onSubmit,
  onCancel,
  submitting,
}) {
  const [values, setValues] = useState(initialValues)
  const [error, setError] = useState('')

  useEffect(() => {
    setValues(initialValues)
    setError('')
  }, [initialValues])

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({
      ...current,
      [name]: value,
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

        {error ? <p className="inline-error">{error}</p> : null}

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? 'Saving…' : mode === 'add' ? 'Add recipe' : 'Save changes'}
        </button>
      </form>
    </section>
  )
}
