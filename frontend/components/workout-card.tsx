import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Dumbbell, Clock, Flame, Info } from "lucide-react"

export function WorkoutCard() {
    return (
        <Card className="w-full overflow-hidden border-none bg-muted/30 shadow-2xl">
            <div className="h-2 w-full bg-gradient-to-r from-primary to-blue-600" />
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today's Focus</span>
                        <CardTitle className="text-3xl font-black italic tracking-tighter uppercase text-white">
                            Front Squat
                        </CardTitle>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-400 border border-blue-500/20">
                            STRENGTH
                        </span>
                        <span className="inline-flex items-center text-xs text-muted-foreground">
                            <Flame className="mr-1 h-3 w-3 text-orange-500" /> High Intensity
                        </span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
                {/* Workout Prescription */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-background/50 p-4 border border-white/5">
                        <div className="flex items-center text-xs text-muted-foreground mb-1">
                            <Dumbbell className="mr-1.5 h-3.5 w-3.5 text-primary" />
                            <span>Sets & Reps</span>
                        </div>
                        <p className="text-2xl font-bold text-white">5 <span className="text-sm font-normal text-muted-foreground">x</span> 3</p>
                    </div>
                    <div className="rounded-xl bg-background/50 p-4 border border-white/5">
                        <div className="flex items-center text-xs text-muted-foreground mb-1">
                            <Clock className="mr-1.5 h-3.5 w-3.5 text-primary" />
                            <span>Rest</span>
                        </div>
                        <p className="text-2xl font-bold text-white">3:00</p>
                    </div>
                </div>

                {/* Load Details */}
                <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Prescribed Load</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-semibold text-white">75-80%</span>
                        <span className="text-sm text-muted-foreground">of 1RM</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[80%] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                    </div>
                </div>

                {/* Coach Notes */}
                <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-yellow-500" />
                        <p className="text-xs font-bold uppercase text-yellow-500 tracking-wider">Coach Notes</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Focus on maintaining an upright torso. Drive your elbows up throughout the movement. Deep breath at the top.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
