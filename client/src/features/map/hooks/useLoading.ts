import { useEffect, useState } from 'react'

/* The template's "loading" moment: grey shapes for a short while, then the content.
   Each new token starts the wait again. */
export const SKEL_MS = 550

export function useLoading(token: number, ms = SKEL_MS) {
  const [doneToken, setDoneToken] = useState<number | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setDoneToken(token), ms)
    return () => clearTimeout(t)
  }, [token, ms])
  return doneToken !== token
}
