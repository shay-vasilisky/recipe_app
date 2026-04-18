import { getContentTextProps, normalizeSearchText } from '../lib/recipe-utils'

function getMatchingTags(availableTags, query, selectedTagIds) {
  const normalizedQuery = normalizeSearchText(query)
  const selectedTagIdSet = new Set(selectedTagIds)

  return availableTags
    .filter((tag) => !selectedTagIdSet.has(tag.id))
    .filter((tag) => {
      if (!normalizedQuery) {
        return false
      }

      return normalizeSearchText(tag.name).includes(normalizedQuery)
    })
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
    .slice(0, 8)
}

export default function ManagedTagAutocomplete({
  availableTags,
  emptyMessage,
  helperText,
  inputId,
  label,
  onAddTag,
  onInputChange,
  onRemoveTag,
  placeholder,
  query,
  selectedTags,
}) {
  const suggestions = getMatchingTags(
    availableTags,
    query,
    selectedTags.map((tag) => tag.id),
  )
  const showSuggestions = Boolean(query.trim())

  function selectTag(tag) {
    onAddTag(tag)
    onInputChange('')
  }

  return (
    <div className="field">
      <label htmlFor={inputId}>
        <span>{label}</span>
      </label>

      <div className="tag-autocomplete">
        {selectedTags.length ? (
          <div className="tag-editor__list">
            {selectedTags.map((tag) => (
              <button
                className="tag-chip tag-chip--editable"
                key={tag.id}
                onClick={() => onRemoveTag(tag)}
                type="button"
              >
                <span className="content-text tag-chip__label" {...getContentTextProps(tag.name)}>
                  {tag.name}
                </span>
                <span aria-hidden="true">x</span>
              </button>
            ))}
          </div>
        ) : null}

        <input
          autoComplete="off"
          className="content-input"
          dir="auto"
          id={inputId}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && suggestions[0]) {
              event.preventDefault()
              selectTag(suggestions[0])
            }
          }}
          placeholder={placeholder}
          type="text"
          value={query}
        />

        {showSuggestions ? (
          suggestions.length ? (
            <div className="tag-autocomplete__menu" role="listbox">
              {suggestions.map((tag) => (
                <button
                  className="tag-autocomplete__option"
                  key={tag.id}
                  onClick={() => selectTag(tag)}
                  type="button"
                >
                  <span className="content-text" {...getContentTextProps(tag.name)}>
                    {tag.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="field__hint">{emptyMessage}</p>
          )
        ) : null}

        {helperText ? <p className="field__hint">{helperText}</p> : null}
      </div>
    </div>
  )
}
