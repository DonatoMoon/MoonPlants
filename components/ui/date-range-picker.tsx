// components/ui/date-range-picker.tsx

"use client"

import * as React from "react"
import { addDays, format } from "date-fns"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"

export function DateRangePicker({
                                    from,
                                    to,
                                    onUpdate,
                                    min,
                                    max,
                                }: {
    from: Date
    to: Date
    onUpdate: (range: { from?: Date; to?: Date }) => void
    min?: Date
    max?: Date
}) {
    const [open, setOpen] = React.useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={"w-full justify-start text-left font-normal"}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {from ? (
                        to ? (
                            <>
                                {format(from, "dd.MM.yyyy")} – {format(to, "dd.MM.yyyy")}
                            </>
                        ) : (
                            format(from, "dd.MM.yyyy")
                        )
                    ) : (
                        <span>Pick a date range</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    initialFocus
                    mode="range"
                    selected={{ from, to }}
                    onSelect={(range) => onUpdate(range ?? {})}
                    numberOfMonths={2}
                    min={min ? min.getTime() : undefined}
                    max={max ? max.getTime() : undefined}
                    required={false}
                />



            </PopoverContent>
        </Popover>
    )
}
