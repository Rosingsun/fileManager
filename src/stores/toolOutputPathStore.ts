import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ToolOutputPathState {
  sharedOutputPath: string
  setSharedOutputPath: (path: string) => void
}

export const useToolOutputPathStore = create<ToolOutputPathState>()(
  persist(
    (set) => ({
      sharedOutputPath: '',
      setSharedOutputPath: (path) => set({ sharedOutputPath: path }),
    }),
    {
      name: 'tool-output-path-storage',
    }
  )
)
