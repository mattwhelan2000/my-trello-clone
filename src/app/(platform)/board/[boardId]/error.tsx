'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Board Runtime Error:', error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-neutral-900 rounded-xl border border-white/10 m-4 shadow-2xl">
            <div className="bg-red-500/20 p-4 rounded-full mb-6">
                <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong!</h2>
            <p className="text-neutral-400 max-w-md mb-8">
                The board encountered a client-side exception. This often happens due to hydration issues or data inconsistencies.
            </p>

            <div className="bg-black/40 rounded-lg p-4 mb-8 text-left w-full max-w-2xl overflow-auto border border-white/5">
                <p className="text-red-400 font-mono text-sm break-all">
                    {error.message || 'Unknown error'}
                </p>
                {error.digest && (
                    <p className="text-neutral-500 font-mono text-[10px] mt-2 tracking-wider">
                        DIGEST: {error.digest}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                    onClick={() => reset()}
                    className="flex items-center gap-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition active:scale-95"
                >
                    <RefreshCcw className="h-4 w-4" />
                    Try again
                </button>
                
                <Link
                    href="/"
                    className="flex items-center gap-x-2 px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-md font-semibold transition active:scale-95 border border-white/10"
                >
                    <Home className="h-4 w-4" />
                    Back to Dashboard
                </Link>
            </div>
        </div>
    )
}
