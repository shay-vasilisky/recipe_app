import { useMemo, useState } from 'react'
import { getContentTextProps } from '../lib/recipe-utils'

function formatUsageCount(count) {
  return `${count} recipe${count === 1 ? '' : 's'}`
}

export default function TagLibrary({
  error,
  isMobileLayout,
  loading,
  onCreateTag,
  onDeleteTag,
  onRenameTag,
  tags,
  usageCounts,
}) {
  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState('')
  const [editingTagName, setEditingTagName] = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const [actionError, setActionError] = useState('')

  const sortedTags = useMemo(
    () => [...tags].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [tags],
  )

  async function handleCreateTag(event) {
    event.preventDefault()
    setActionError('')
    setPendingAction('create')

    try {
      await onCreateTag(newTagName)
      setNewTagName('')
    } catch (createError) {
      setActionError(createError.message || 'Unable to create tag.')
    } finally {
      setPendingAction('')
    }
  }

  async function handleRenameTag(tag) {
    setActionError('')
    setPendingAction(`rename:${tag.id}`)

    try {
      await onRenameTag(tag.id, editingTagName)
      setEditingTagId('')
      setEditingTagName('')
    } catch (renameError) {
      setActionError(renameError.message || 'Unable to rename tag.')
    } finally {
      setPendingAction('')
    }
  }

  async function handleDeleteTag(tag) {
    const confirmed = window.confirm(`Delete "${tag.name}"? This removes it from every recipe.`)

    if (!confirmed) {
      return
    }

    setActionError('')
    setPendingAction(`delete:${tag.id}`)

    try {
      await onDeleteTag(tag.id)

      if (editingTagId === tag.id) {
        setEditingTagId('')
        setEditingTagName('')
      }
    } catch (deleteError) {
      setActionError(deleteError.message || 'Unable to delete tag.')
    } finally {
      setPendingAction('')
    }
  }

  return (
    <section className={`panel tag-library${isMobileLayout ? ' tag-library--mobile' : ''}`}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Admin Tool</p>
          <h2>Tag manager</h2>
        </div>
      </div>

      <form className="tag-library__create" onSubmit={handleCreateTag}>
        <input
          autoComplete="off"
          className="content-input"
          onChange={(event) => setNewTagName(event.target.value)}
          placeholder="Add a tag"
          type="text"
          value={newTagName}
        />
        <button className="ghost-button" disabled={pendingAction === 'create'} type="submit">
          {pendingAction === 'create' ? 'Adding…' : 'Add tag'}
        </button>
      </form>

      <p className="field__hint">
        Add, rename, or delete shared tags here. Changes apply to the shared cookbook for both users.
      </p>

      {error ? <p className="inline-error">{error}</p> : null}
      {actionError ? <p className="inline-error">{actionError}</p> : null}

      {loading ? (
        <p className="tag-library__empty">Loading tags…</p>
      ) : !sortedTags.length ? (
        <p className="tag-library__empty">No tags yet. Add the first shared tag above.</p>
      ) : (
        <div className="tag-library__list">
          {sortedTags.map((tag) => {
            const isEditing = editingTagId === tag.id
            const isDeleting = pendingAction === `delete:${tag.id}`
            const isRenaming = pendingAction === `rename:${tag.id}`

            return (
              <article className="tag-library__item" key={tag.id}>
                <div className="tag-library__body">
                  {isEditing ? (
                    <input
                      autoComplete="off"
                      className="content-input"
                      onChange={(event) => setEditingTagName(event.target.value)}
                      type="text"
                      value={editingTagName}
                    />
                  ) : (
                    <p className="tag-library__name content-text" {...getContentTextProps(tag.name)}>
                      {tag.name}
                    </p>
                  )}

                  <p className="tag-library__meta">{formatUsageCount(usageCounts[tag.id] || 0)}</p>
                </div>

                <div className="tag-library__actions">
                  {isEditing ? (
                    <>
                      <button
                        className="ghost-button"
                        disabled={isRenaming}
                        onClick={() => handleRenameTag(tag)}
                        type="button"
                      >
                        {isRenaming ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() => {
                          setEditingTagId('')
                          setEditingTagName('')
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="ghost-button"
                      onClick={() => {
                        setEditingTagId(tag.id)
                        setEditingTagName(tag.name)
                      }}
                      type="button"
                    >
                      Rename
                    </button>
                  )}

                  <button
                    className="ghost-button ghost-button--danger"
                    disabled={isDeleting}
                    onClick={() => handleDeleteTag(tag)}
                    type="button"
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
