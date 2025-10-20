// components/profile/SpeciesAutocomplete.tsx
'use client';
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Option = { id: number; name: string; image?: string };

export default function SpeciesAutocomplete({
                                                value,
                                                onChange,
                                                ...props
                                            }: {
    value: string;
    onChange: (v: { name: string, id: number }) => void;
    placeholder?: string;
    className?: string;
}) {
    const [suggestions, setSuggestions] = useState<Option[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // debounce
    const fetchSuggestions = useMemo(() => {
        let timeout: any;
        return (q: string) => {
            if (!q) return setSuggestions([]);
            setLoading(true);
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                const res = await fetch(`/api/perenual-autocomplete?q=${encodeURIComponent(q)}`);
                const { data } = await res.json();
                setSuggestions(data);
                setLoading(false);
                setOpen(true);
            }, 350);
        }
    }, []);

    return (
        <div className="relative">
            <Input
                {...props}
                value={value}
                onChange={e => {
                    // Звичайний текстовий інпут — скидуємо species_id
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
                            {opt.image && <img src={opt.image} alt="" className="w-7 h-7 rounded object-cover" />}
                            {opt.name}
                        </li>
                    ))}
                </ul>
            )}
            {loading && <div className="absolute right-2 top-2 text-xs text-gray-400">loading...</div>}
        </div>
    );
}
