import { create } from 'zustand'
import type { ImageClassificationResult, ImageClassificationProgress } from '../types'

interface ImageClassificationState {
  results: Map<string, ImageClassificationResult>
  isClassifying: boolean
  progress: ImageClassificationProgress | null
  modelLoaded: boolean

  setResults: (results: ImageClassificationResult[]) => void
  addResult: (result: ImageClassificationResult) => void
  clearResults: () => void
  setClassifying: (isClassifying: boolean) => void
  setProgress: (progress: ImageClassificationProgress | null) => void
  setModelLoaded: (loaded: boolean) => void
  getResult: (filePath: string) => ImageClassificationResult | undefined
  getResultsByCategory: (category: string) => ImageClassificationResult[]
}

export const useImageClassificationStore = create<ImageClassificationState>((set, get) => ({
  results: new Map(),
  isClassifying: false,
  progress: null,
  modelLoaded: false,

  setResults: (results) => {
    const newResults = new Map<string, ImageClassificationResult>()
    for (const result of results) {
      newResults.set(result.filePath, result)
    }
    set({ results: newResults })
  },

  addResult: (result) => {
    set((state) => {
      const newResults = new Map(state.results)
      newResults.set(result.filePath, result)
      return { results: newResults }
    })
  },

  clearResults: () => {
    set({ results: new Map(), progress: null })
  },

  setClassifying: (isClassifying) => {
    set({ isClassifying })
  },

  setProgress: (progress) => {
    set({ progress })
  },

  setModelLoaded: (modelLoaded) => {
    set({ modelLoaded })
  },

  getResult: (filePath) => {
    return get().results.get(filePath)
  },

  getResultsByCategory: (category) => {
    const results: ImageClassificationResult[] = []
    get().results.forEach((result) => {
      if (result.category === category) {
        results.push(result)
      }
    })
    return results
  }
}))
