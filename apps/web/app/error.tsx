// app/error.tsx
'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <html>
        <body>
        <div className="min-h-screen flex flex-col justify-center items-center bg-main text-white">
            <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
            <p className="mb-6">{error.message}</p>
            <button
                className="bg-accent px-4 py-2 rounded-lg font-bold"
                onClick={() => reset()}
            >
                Try again
            </button>
        </div>
        </body>
        </html>
    );
}
