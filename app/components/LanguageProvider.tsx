'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isLocale, localeDetails, locales, translate, type Locale } from '@/app/lib/i18n'
import './language.css'

const STORAGE_KEY = 'optimus-manager-language'
type TranslationRecord = { source: string; rendered: string }
const textSources = new WeakMap<Text, TranslationRecord>()
const attributeSources = new WeakMap<Element, Map<string, TranslationRecord>>()
const translatedAttributes = ['placeholder', 'aria-label', 'title', 'alt']
const LocaleContext = createContext<Locale>('en')

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

function savedLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved && isLocale(saved) ? saved : 'en'
  } catch {
    return 'en'
  }
}

function sourceForAttribute(element: Element, name: string, current: string): string {
  let values = attributeSources.get(element)
  if (!values) {
    values = new Map()
    attributeSources.set(element, values)
  }
  const record = values.get(name)
  if (!record || record.rendered !== current) {
    values.set(name, { source: current, rendered: current })
    return current
  }
  return record.source
}

function translateElement(owner: Element, locale: Locale) {
  if (!owner.closest('[data-language-control]')) {
    for (const attribute of translatedAttributes) {
      if (!owner.hasAttribute(attribute)) continue
      const current = owner.getAttribute(attribute) ?? ''
      const source = sourceForAttribute(owner, attribute, current)
      const next = translate(source, locale)
      if (current !== next) {
        owner.setAttribute(attribute, next)
        attributeSources.get(owner)?.set(attribute, { source, rendered: next })
      }
    }
  }
}

function translateTree(root: Node, locale: Locale) {
  const owner = root instanceof Element ? root : root.parentElement
  if (owner) translateElement(owner, locale)

  const elements = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let element: Node | null
  while ((element = elements.nextNode())) translateElement(element as Element, locale)

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const textNode = node as Text
    const parent = textNode.parentElement
    if (!parent || parent.closest('script,style,noscript,[data-language-control]')) continue
    const current = textNode.nodeValue ?? ''
    const record = textSources.get(textNode)
    const source = record?.rendered === current ? record.source : current
    const next = translate(source, locale)
    if (current !== next) textNode.nodeValue = next
    textSources.set(textNode, { source, rendered: next })
  }
}

function setDocumentLocale(locale: Locale) {
  const details = localeDetails[locale]
  document.documentElement.lang = details.tag
  document.documentElement.dir = details.dir
  document.documentElement.dataset.language = locale
  translateTree(document.body, locale)
  document.documentElement.dataset.languageReady = 'true'
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')

  const changeLocale = useCallback((value: string) => {
    if (!isLocale(value)) return
    setLocale(value)
    try { localStorage.setItem(STORAGE_KEY, value) } catch { /* storage may be disabled */ }
    setDocumentLocale(value)
  }, [])

  useEffect(() => {
    const initial = savedLocale()
    const frame = window.requestAnimationFrame(() => {
      setLocale(initial)
      setDocumentLocale(initial)
    })
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof Element) {
          translateTree(record.target, savedLocale())
        } else if (record.type === 'characterData' && record.target instanceof Text) {
          translateTree(record.target, savedLocale())
        } else {
          record.addedNodes.forEach((node) => translateTree(node, savedLocale()))
        }
      }
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatedAttributes,
    })
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return <LocaleContext.Provider value={locale}>
    {children}
    <div className="opt-language-control" data-language-control>
      <label className="opt-language-label" htmlFor="opt-language-select">{localeDetails[locale].label}</label>
      <select id="opt-language-select" value={locale} onChange={(event) => changeLocale(event.target.value)} aria-label={localeDetails[locale].label}>
        {locales.map((code) => <option key={code} value={code}>{localeDetails[code].native}</option>)}
      </select>
    </div>
  </LocaleContext.Provider>
}
