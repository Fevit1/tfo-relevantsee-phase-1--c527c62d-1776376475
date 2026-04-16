'use client'

import { useState, useRef } from 'react'

export function TagInput({
  value = [],
  onChange,
  placeholder = 'Type and press Enter',
  maxItems,
  disabled,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault()
      const newTag = inputValue.trim()
      if (!value.includes(newTag)) {
        if (maxItems && value.length >= maxItems) return
        onChange([...value, newTag])
      }
      setInputValue('')
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeTag = (tag) => {
    onChange(value.filter(t => t !== tag))
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[42px] w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 cursor-text focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-colors duration-150"
      onClick={() => inputRef.current?.focus()}
      role="group"
      aria-label={ariaLabel}
    >
      {value.length > 0 && (
        <ul
          role="list"
          className="contents"
          aria-label={ariaLabel ? `${ariaLabel} tags` : 'Tags'}
        >
          {value.map(tag => (
            <li
              key={tag}
              role="listitem"
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-900 text-indigo-200 text-xs rounded-md border border-indigo-700"
            >
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                  aria-label={`Remove ${tag}`}
                  className="text-indigo-400 hover:text-white hover:bg-indigo-700 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-indigo-900 leading-none w-4 h-4 inline-flex items-center justify-center"
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (!maxItems || value.length < maxItems) && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          aria-label={ariaLabel ?? placeholder}
          aria-describedby={ariaDescribedBy}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:rounded"
        />
      )}
    </div>
  )
}