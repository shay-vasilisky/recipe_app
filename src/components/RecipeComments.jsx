import { useEffect, useState } from 'react'
import { getContentTextProps, normalizeUserEmail } from '../lib/recipe-utils'
import {
  addRecipeComment,
  deleteRecipeComment,
  subscribeToRecipeComments,
  updateRecipeComment,
} from '../services/recipes'

function getCommentErrorMessage(error, fallbackMessage) {
  if (error?.code === 'permission-denied') {
    return 'Comments need the latest Firestore rules published before they can load or save.'
  }

  return error?.message || fallbackMessage
}

function formatCommentCount(commentCount = 0) {
  return `${commentCount} comment${commentCount === 1 ? '' : 's'}`
}

function formatCommentTimestamp(comment) {
  const createdAt = comment?.createdAt?.toDate?.()
  const updatedAt = comment?.updatedAt?.toDate?.()
  const format = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  if (updatedAt && createdAt && updatedAt.getTime() > createdAt.getTime()) {
    return `Edited ${format.format(updatedAt)}`
  }

  if (createdAt) {
    return format.format(createdAt)
  }

  return 'Just now'
}

function CommentEditor({
  disabled,
  label,
  onCancel,
  onChange,
  onSubmit,
  placeholder,
  saveLabel,
  value,
}) {
  return (
    <form className="recipe-comments__editor" onSubmit={onSubmit}>
      <label className="field">
        <span>{label}</span>
        <textarea
          className="content-input"
          disabled={disabled}
          dir="auto"
          onChange={onChange}
          placeholder={placeholder}
          rows="3"
          value={value}
        />
      </label>

      <div className="recipe-comments__actions">
        <button className="primary-button" disabled={disabled} type="submit">
          {saveLabel}
        </button>
        {onCancel ? (
          <button className="ghost-button" disabled={disabled} onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}

export default function RecipeComments({ currentUser, recipe }) {
  const [comments, setComments] = useState([])
  const [commentsError, setCommentsError] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState('')
  const [editingCommentText, setEditingCommentText] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [savingCommentId, setSavingCommentId] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const currentUserEmail = normalizeUserEmail(currentUser?.email)
  const commentsSectionId = `recipe-comments-${recipe.id}`

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    setCommentsLoading(true)
    setCommentsError('')

    const unsubscribe = subscribeToRecipeComments(
      recipe.id,
      (nextComments) => {
        setComments(nextComments)
        setCommentsLoading(false)
      },
      (error) => {
        setCommentsError(getCommentErrorMessage(error, 'Unable to load comments.'))
        setCommentsLoading(false)
      },
    )

    return unsubscribe
  }, [isOpen, recipe.id])

  function handleToggleComments() {
    setIsOpen((currentValue) => !currentValue)
  }

  function handleEditStart(comment) {
    setCommentsError('')
    setEditingCommentId(comment.id)
    setEditingCommentText(comment.text)
  }

  function handleEditCancel() {
    setEditingCommentId('')
    setEditingCommentText('')
  }

  async function handleAddComment(event) {
    event.preventDefault()
    setCommentsError('')
    setSubmittingComment(true)

    try {
      await addRecipeComment(recipe.id, draftComment, currentUser)
      setDraftComment('')
    } catch (error) {
      setCommentsError(getCommentErrorMessage(error, 'Unable to save comment.'))
    } finally {
      setSubmittingComment(false)
    }
  }

  async function handleCommentUpdate(event) {
    event.preventDefault()

    if (!editingCommentId) {
      return
    }

    setCommentsError('')
    setSavingCommentId(editingCommentId)

    try {
      await updateRecipeComment(recipe.id, editingCommentId, editingCommentText)
      handleEditCancel()
    } catch (error) {
      setCommentsError(getCommentErrorMessage(error, 'Unable to update comment.'))
    } finally {
      setSavingCommentId('')
    }
  }

  async function handleCommentDelete(comment) {
    const confirmed = window.confirm('Delete this comment?')

    if (!confirmed) {
      return
    }

    setCommentsError('')
    setSavingCommentId(comment.id)

    try {
      await deleteRecipeComment(recipe.id, comment.id)

      if (editingCommentId === comment.id) {
        handleEditCancel()
      }
    } catch (error) {
      setCommentsError(getCommentErrorMessage(error, 'Unable to delete comment.'))
    } finally {
      setSavingCommentId('')
    }
  }

  return (
    <section className={`recipe-comments${isOpen ? ' recipe-comments--open' : ''}`}>
      <button
        aria-controls={commentsSectionId}
        aria-expanded={isOpen}
        className={`ghost-button recipe-comments__toggle${isOpen ? ' ghost-button--active' : ''}`}
        onClick={handleToggleComments}
        type="button"
      >
        <span>{isOpen ? 'Hide comments' : 'Comments'}</span>
        <span className="recipe-comments__toggle-count">{formatCommentCount(recipe.commentCount)}</span>
      </button>

      {isOpen ? (
        <div className="recipe-comments__panel" id={commentsSectionId}>
          {commentsError ? <p className="inline-error">{commentsError}</p> : null}

          {commentsLoading ? (
            <p className="recipe-comments__status">Loading comments…</p>
          ) : comments.length ? (
            <div className="recipe-comments__thread">
              {comments.map((comment) => {
                const isOwnComment = currentUserEmail && currentUserEmail === comment.authorEmail
                const isSavingThisComment = savingCommentId === comment.id

                return (
                  <article className="recipe-comments__item" key={comment.id}>
                    <div className="recipe-comments__meta">
                      <p className="recipe-comments__author">{comment.authorName || comment.authorEmail || 'Unknown user'}</p>
                      <p className="recipe-comments__timestamp">{formatCommentTimestamp(comment)}</p>
                    </div>

                    {editingCommentId === comment.id ? (
                      <CommentEditor
                        disabled={isSavingThisComment}
                        label="Edit comment"
                        onCancel={handleEditCancel}
                        onChange={(event) => setEditingCommentText(event.target.value)}
                        onSubmit={handleCommentUpdate}
                        placeholder="Update your comment"
                        saveLabel={isSavingThisComment ? 'Saving…' : 'Save comment'}
                        value={editingCommentText}
                      />
                    ) : (
                      <>
                        <p
                          className="recipe-comments__text content-text"
                          {...getContentTextProps(comment.text)}
                        >
                          {comment.text}
                        </p>

                        {isOwnComment ? (
                          <div className="recipe-comments__actions">
                            <button className="ghost-button" onClick={() => handleEditStart(comment)} type="button">
                              Edit
                            </button>
                            <button
                              className="ghost-button ghost-button--danger"
                              disabled={isSavingThisComment}
                              onClick={() => handleCommentDelete(comment)}
                              type="button"
                            >
                              {isSavingThisComment ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="recipe-comments__status">No comments yet. Add the first one.</p>
          )}

          <CommentEditor
            disabled={submittingComment}
            label="Add a comment"
            onChange={(event) => setDraftComment(event.target.value)}
            onSubmit={handleAddComment}
            placeholder="Share a tip, note, or cooking result"
            saveLabel={submittingComment ? 'Posting…' : 'Post comment'}
            value={draftComment}
          />
        </div>
      ) : null}
    </section>
  )
}
