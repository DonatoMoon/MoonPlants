export default function Loading() {
    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-main text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-accent"></div>
            <span className="mt-4">Loading...</span>
        </div>
    );
}
