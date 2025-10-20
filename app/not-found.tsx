export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-main text-white">
            <h1 className="text-3xl font-bold mb-4">404 — Page not found</h1>
            <p className="mb-6">Sorry, we couldn’t find the page you’re looking for.</p>
            <a href="/" className="underline text-accent">Go home</a>
        </div>
    );
}
