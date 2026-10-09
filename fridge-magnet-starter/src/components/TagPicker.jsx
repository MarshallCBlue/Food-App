import { useState } from 'react'
import Icon from './Icon'
import { cleanTag, sameTag } from '../lib/recipeTags'

// The "Tags" part of the recipe form. Shows the recipe's tags (tap one
// to remove it), a box for typing new ones, and the household's other
// tags as one-tap shortcuts, so the same tag is not typed five slightly
// different ways.
export default function TagPicker({ tags, knownTags, onChange }) {
  const [draft, setDraft] = useState('')

  // Accepts one tag or several separated by commas ("Quick, Vegetarian").
  function addTags(text) {
    const next = [...tags]
    for (const piece of text.split(',')) {
      const tag = cleanTag(piece)
      if (!tag || next.some((existing) => sameTag(existing, tag))) continue
      // Reuse the spelling already used on other recipes, if there is one.
      next.push(knownTags.find((known) => sameTag(known, tag)) || tag)
    }
    onChange(next)
    setDraft('')
  }

  function removeTag(tag) {
    onChange(tags.filter((existing) => existing !== tag))
  }

  const unused = knownTags.filter((known) => !tags.some((tag) => sameTag(tag, known)))

  return (
    <div className="fm-label" role="group" aria-label="Tags">
      Tags (optional)
      {tags.length > 0 && (
        <div className="fm-chips fm-chips--wrap">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="fm-chip is-on"
              onClick={() => removeTag(tag)}
              aria-label={`Remove the ${tag} tag`}
            >
              {tag}
              <Icon name="close" />
            </button>
          ))}
        </div>
      )}

      <div className="fm-inline">
        <input
          className="fm-field"
          placeholder="e.g. Quick, Vegetarian"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter adds the tag instead of saving the whole recipe.
            if (event.key === 'Enter') {
              event.preventDefault()
              addTags(draft)
            }
          }}
          aria-label="New tag"
        />
        <button type="button" className="fm-btn fm-btn--secondary" disabled={!draft.trim()} onClick={() => addTags(draft)}>
          Add
        </button>
      </div>

      {unused.length > 0 && (
        <div className="fm-chips fm-chips--wrap">
          {unused.map((tag) => (
            <button key={tag} type="button" className="fm-chip" onClick={() => addTags(tag)}>
              <Icon name="plus" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
