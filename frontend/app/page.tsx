"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dumbbell, Loader2 } from "lucide-react"

import { API_BASE_URL } from "@/lib/config"

export default function LoginPage() {
    const [isLogin, setIsLogin] = React.useState(true)
    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [name, setName] = React.useState("")
    const [role, setRole] = React.useState("athlete")
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        const url = isLogin ? `${API_BASE_URL}/login` : `${API_BASE_URL}/register`
        const body = isLogin
            ? { email, password }
            : { name, email, password, role }

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                const user = await res.json()
                // Save to local storage for persistence
                localStorage.setItem("ironlens_user", JSON.stringify(user))
                // Force reload to hit the dashboard auth check
                window.location.href = "/dashboard"
            } else {
                const data = await res.json()
                setError(data.detail || "Authentication failed")
            }
        } catch (err) {
            setError("Network error. Is backend running?")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <div className="h-16 w-16 mx-auto rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] mb-6">
                        <Dumbbell className="h-8 w-8 text-black" />
                    </div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-white">
                        IRON<span className="text-primary">LENS</span>
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        {isLogin ? "Welcome back, athlete." : "Join the community."}
                    </p>
                </div>

                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {!isLogin && (
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                    value={name} onChange={(e) => setName(e.target.value)}
                                    className="bg-zinc-800 border-transparent h-12" required
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                className="bg-zinc-800 border-transparent h-12" required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input
                                type="password"
                                value={password} onChange={(e) => setPassword(e.target.value)}
                                className="bg-zinc-800 border-transparent h-12" required
                            />
                        </div>

                        {!isLogin && (
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRole("athlete")}
                                        className={`h-10 rounded-lg text-sm font-bold border ${role === 'athlete' ? 'bg-primary text-black border-primary' : 'bg-transparent text-muted-foreground border-zinc-700'}`}
                                    >
                                        Athlete
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole("coach")}
                                        className={`h-10 rounded-lg text-sm font-bold border ${role === 'coach' ? 'bg-primary text-black border-primary' : 'bg-transparent text-muted-foreground border-zinc-700'}`}
                                    >
                                        Coach
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

                        <Button type="submit" className="w-full h-12 text-lg font-bold rounded-xl" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLogin ? "Sign In" : "Create Account"}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-sm text-muted-foreground hover:text-white transition-colors"
                        >
                            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
