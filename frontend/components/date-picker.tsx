"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { format, addDays, startOfWeek, isSameDay } from "date-fns"

export function HorizontalDatePicker({
    selectedDate,
    onDateSelect
}: {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}) {
    const startDate = startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday

    const dates = React.useMemo(() => {
        return Array.from({ length: 14 }).map((_, i) => addDays(startDate, i - 1))
    }, [startDate])

    return (
        <div className="w-full relative">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className="w-full overflow-x-auto pb-4 pt-2 no-scrollbar scroll-smooth">
                <div className="flex space-x-3 px-4 min-w-max">
                    {dates.map((date) => {
                        const isSelected = isSameDay(date, selectedDate)
                        const isToday = isSameDay(date, new Date())

                        return (
                            <button
                                key={date.toString()}
                                onClick={() => onDateSelect(date)}
                                className={cn(
                                    "flex flex-col items-center justify-center min-w-[4rem] h-20 rounded-2xl border transition-all duration-200 ease-out",
                                    isSelected
                                        ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(34,197,94,0.3)] scale-105"
                                        : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:border-sidebar-border",
                                    isToday && !isSelected && "border-primary/50 text-primary"
                                )}
                            >
                                <span className="text-xs font-medium uppercase tracking-wider mb-1">
                                    {format(date, "EEE")}
                                </span>
                                <span className={cn("text-2xl font-bold font-mono tracking-tighter", isSelected && "text-black")}>
                                    {format(date, "d")}
                                </span>
                                {isToday && (
                                    <div className="w-1 h-1 bg-current rounded-full mt-1" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
