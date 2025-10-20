// components/profile/SpeciesAutocomplete.tsx
'use client';
import { useState, useMemo, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import Image from "next/image";

type Option = { id: number; name: string; image?: string };

export default function SpeciesAutocomplete({
                                                value,
                                                onChange,
                                                ...props
                                            }: {
    value: string;
    onChange: (v: { name: string; id: number }) => void;
    placeholder?: string;
    className?: string;
}) {
    const [suggestions, setSuggestions] = useState<Option[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchSuggestions = useCallback((q: string) => {
        if (!q) {
            setSuggestions([]);
            setOpen(false);
            return;
        }
        setLoading(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(async () => {
            const res = await fetch(`/api/perenual-autocomplete?q=${encodeURIComponent(q)}`);
            const { data } = await res.json() as { data: Option[] };
            setSuggestions(data);
            setLoading(false);
            setOpen(true);
        }, 350);
    }, []);

    // cleanup timeout on unmount
    useMemo(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

    return (
        <div className="relative">
            <Input
                {...props}
                value={value}
                onChange={e => {
                    onChange({ name: e.target.value, id: 0 });
                    fetchSuggestions(e.target.value);
                }}
                autoComplete="off"
            />
            {open && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-md max-h-56 overflow-auto">
                    {suggestions.map(opt => (
                        <li
                            key={opt.id}
                            onClick={() => {
                                onChange({ name: opt.name, id: opt.id });
                                setOpen(false);
                            }}
                            className="cursor-pointer px-3 py-2 hover:bg-green-100 text-black flex items-center gap-2"
                        >
                            {opt.image && (
                                <Image
                                    src={opt.image}
                                    alt={opt.name}
                                    width={28}
                                    height={28}
                                    className="rounded object-cover"
                                />
                            )}
                            {opt.name}
                        </li>
                    ))}
                </ul>
            )}
            {loading && <div className="absolute right-2 top-2 text-xs text-gray-400">loading...</div>}
        </div>
    );
}
