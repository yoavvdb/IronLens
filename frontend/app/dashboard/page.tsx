"use client"

import * as React from "react"
import { HorizontalDatePicker } from "@/components/date-picker"
import { Button } from "@/components/ui/button"
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Upload, Loader2, Dumbbell, ChevronUp, ChevronDown, Plus, MessageSquare, ThumbsUp, Medal, Save, LogOut, Edit3, FolderOpen, Pencil, Trash2, Video, VideoOff, Maximize2, Bell, Check, Camera, X, GripVertical, Copy, Search, UserCheck, Menu } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

import { API_BASE_URL } from "@/lib/config"

// --- Types ---
interface User {
    id: string;
    name: string;
    email: string;
    role: 'athlete' | 'coach';
    avatar_url: string;
    access_code?: string; // For coaches
    followed_coach_id?: string; // For athletes
}

interface ProgrammingSet {
    id: string;
    type: 'working' | 'warmup' | 'note' | 'movement' | 'complex';
    reps?: string;
    weight?: string;
    text?: string;
    target_sets?: string;  // New field for "N x Reps"
}

interface ProgrammingBlock {
    id: string;
    name: string;
    type: 'strength' | 'metcon';
    metcon_type?: 'AMRAP' | 'EMOM' | 'For Time' | 'Other';
    metcon_duration?: string;
    description?: string;
    data: ProgrammingSet[];
}

interface Comment {
    id: string;
    user_id: string;
    user_name: string;
    user_role: string;
    user_avatar: string;
    text: string;
    is_coach_feedback: boolean;
    created_at: string;
}

interface Log {
    id: string;
    title: string;
    result_score: string;
    video_url: string | null;
    thumbnail_url: string | null;
    created_at: string;
    user_id: string;
    user_name: string;
    user_avatar: string;
    kudos_count: number;
    comments: Comment[];
}

interface LogEntrySet {
    id: string; // temp id for UI
    result: string;
    file: File | null;
}

interface Notification {
    id: string;
    sender_id: string;
    sender_name: string;
    sender_avatar: string;
    type: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

// Sortable Block Component
interface SortableBlockProps {
    block: ProgrammingBlock;
    index: number;
    updateBlock: (index: number, field: keyof ProgrammingBlock, value: any) => void;
    updateSetInBlock: (blockIndex: number, setIndex: number, field: keyof ProgrammingSet, value: any) => void;
    removeSetFromBlock: (blockIndex: number, setIndex: number) => void;
    addSetToBlock: (blockIndex: number, type: 'working' | 'warmup' | 'note' | 'movement') => void;
    duplicateBlock: (index: number) => void;
    removeBlock: (index: number) => void;
}

function SortableBlock({
    block,
    index,
    updateBlock,
    updateSetInBlock,
    removeSetFromBlock,
    addSetToBlock,
    duplicateBlock,
    removeBlock
}: SortableBlockProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "bg-muted/20 p-4 rounded-xl border space-y-4",
                isDragging ? "border-primary ring-2 ring-primary/50" : "border-white/10"
            )}
        >
            {/* Block Header */}
            <div className="flex items-center gap-3">
                {/* Drag Handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded transition-colors"
                >
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                </button>

                <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                        <Input
                            value={block.name}
                            onChange={(e) => updateBlock(index, 'name', e.target.value)}
                            className="h-9 bg-black/40 font-bold border-white/10"
                            placeholder="Exercise Name / WOD Title"
                        />
                        <select
                            className="h-9 bg-black/40 border border-white/10 rounded-md px-3 text-xs"
                            value={block.type}
                            onChange={(e) => updateBlock(index, 'type', e.target.value)}
                        >
                            <option value="strength">Strength</option>
                            <option value="metcon">Metcon</option>
                        </select>
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 shrink-0 border-white/10 hover:bg-primary/20 hover:border-primary"
                            onClick={() => duplicateBlock(index)}
                            title="Duplicate block"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-9 w-9 shrink-0" onClick={() => removeBlock(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content Editor */}
            {block.type === 'metcon' ? (
                // Simple Text Area for Metcon
                <div className="animate-in fade-in slide-in-from-top-1">
                    <textarea
                        value={block.description || ""}
                        onChange={(e) => updateBlock(index, 'description', e.target.value)}
                        className="w-full h-32 bg-black/20 border border-white/10 rounded-md p-3 text-sm font-mono text-white resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Enter WOD details here (e.g. 21-15-9 Thrusters...)"
                    />
                </div>
            ) : (
                // Sets Editor for Strength
                <div className="space-y-2 pl-4 border-l-2 border-white/5 animate-in fade-in slide-in-from-top-1">
                    {block.data.map((set, si) => (
                        <div key={set.id} className="flex flex-wrap md:flex-nowrap gap-2 items-center group mb-2 border-b border-white/5 pb-2 md:border-0 md:pb-0 md:mb-0">
                            {/* Primary Data Row */}
                            <div className="flex items-center gap-2">
                                <select
                                    className="h-10 w-24 bg-black/20 text-base rounded border border-white/5 text-muted-foreground"
                                    value={set.type}
                                    onChange={(e) => updateSetInBlock(index, si, 'type', e.target.value)}
                                >
                                    <option value="working">Work</option>
                                    <option value="note">Note</option>
                                </select>

                                {set.type === 'working' && (
                                    <>
                                        {/* Optional Sets Count (The "Batch" integration) */}
                                        <Input
                                            value={set.target_sets || ""}
                                            onChange={(e) => updateSetInBlock(index, si, 'target_sets', e.target.value)}
                                            className="h-10 w-12 bg-black/20 text-base border-white/5 font-mono text-center px-0 focus:ring-0 placeholder:text-white/20"
                                            placeholder="Set"
                                        />
                                        <span className="text-muted-foreground text-xs font-mono">x</span>

                                        <Input
                                            value={set.reps || ""}
                                            onChange={(e) => updateSetInBlock(index, si, 'reps', e.target.value)}
                                            className="h-10 w-16 bg-black/20 text-base border-white/5 font-mono text-center px-1"
                                            placeholder="Reps"
                                        />
                                        <span className="text-muted-foreground text-sm">@</span>
                                        <Input
                                            value={set.weight || ""}
                                            onChange={(e) => updateSetInBlock(index, si, 'weight', e.target.value)}
                                            className="h-10 w-24 bg-black/20 text-base border-white/5 font-mono text-center px-1"
                                            placeholder="Load"
                                        />
                                    </>
                                )}
                            </div>

                            {/* Note Input - Full Width on Mobile, Flex on Desktop */}
                            <div className="w-full md:w-auto md:flex-1 min-w-[150px]">
                                <Input
                                    value={set.text || ""}
                                    onChange={(e) => updateSetInBlock(index, si, 'text', e.target.value)}
                                    className="h-10 w-full bg-black/20 text-base border-white/5"
                                    placeholder={set.type === 'movement' ? "e.g. 15 Thrusters" : "Notes..."}
                                />
                            </div>

                            <button onClick={() => removeSetFromBlock(index, si)} className="text-muted-foreground hover:text-red-500 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity p-2">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}

                    <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:text-white" onClick={() => addSetToBlock(index, 'working')}>
                            + Set
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:text-white" onClick={() => addSetToBlock(index, 'movement')}>
                            + Move
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:text-white" onClick={() => addSetToBlock(index, 'note')}>
                            + Note
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DashboardPage() {
    // --- Auth State ---
    const [currentUser, setCurrentUser] = React.useState<User | null>(null)

    // --- Data State ---
    const [selectedDate, setSelectedDate] = React.useState(new Date())
    const [logs, setLogs] = React.useState<Log[]>([])
    const [programming, setProgramming] = React.useState<ProgrammingBlock[]>([])
    const [notifications, setNotifications] = React.useState<Notification[]>([])

    // --- Programming Editor State ---
    const [isEditingPlan, setIsEditingPlan] = React.useState(false)
    const [editedPlan, setEditedPlan] = React.useState<ProgrammingBlock[]>([])

    // --- Log Form State (Multi-Set) ---
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [success, setSuccess] = React.useState(false)
    const [title, setTitle] = React.useState("")
    const [inputSets, setInputSets] = React.useState<LogEntrySet[]>([]) // For creating new logs

    // --- Edit Mode State (Single Log) ---
    const [editingLogId, setEditingLogId] = React.useState<string | null>(null)
    const [editResult, setEditResult] = React.useState("")
    const [editFile, setEditFile] = React.useState<File | null>(null)
    const [removeVideo, setRemoveVideo] = React.useState(false)

    // --- Detail View State (Comments) ---
    const [viewingLog, setViewingLog] = React.useState<Log | null>(null) // The specific log clicked (for video)
    const [sessionLogs, setSessionLogs] = React.useState<Log[]>([]) // All logs in this session (for comments)
    const [commentText, setCommentText] = React.useState("")
    const [commentImage, setCommentImage] = React.useState<Blob | null>(null)
    const [commentImagePreview, setCommentImagePreview] = React.useState<string | null>(null)

    const videoRef = React.useRef<HTMLVideoElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)

    // --- UI State ---
    const [drawerOpen, setDrawerOpen] = React.useState(false)
    const [detailDrawerOpen, setDetailDrawerOpen] = React.useState(false)
    const [expandedFolder, setExpandedFolder] = React.useState<string | null>(null)
    const [expandedAthlete, setExpandedAthlete] = React.useState<string | null>(null)
    const [showAllAthletes, setShowAllAthletes] = React.useState(false)
    const [notifOpen, setNotifOpen] = React.useState(false)
    const [expandedAthletes, setExpandedAthletes] = React.useState<Record<string, boolean>>({})
    const [menuOpen, setMenuOpen] = React.useState(false)

    // --- Coach Access State ---
    const [isCoachSearchOpen, setIsCoachSearchOpen] = React.useState(false)
    const [coachSearchQuery, setCoachSearchQuery] = React.useState("")
    const [foundCoaches, setFoundCoaches] = React.useState<User[]>([])
    const [isJoiningCoach, setIsJoiningCoach] = React.useState<User | null>(null)
    const [accessCodeInput, setAccessCodeInput] = React.useState("")
    const [isSettingAccessCode, setIsSettingAccessCode] = React.useState(false)
    const [newAccessCode, setNewAccessCode] = React.useState("")

    // --- Helper: Smart Score Parser ---
    const parseScore = (score: string): { value: number; type: 'time' | 'weight' | 'reps' } => {
        // Time format: "5:30" or "1:23:45"
        if (score.includes(':')) {
            const parts = score.split(':').map(p => parseInt(p) || 0)
            const seconds = parts.reduce((acc, part, i) =>
                acc + part * Math.pow(60, parts.length - 1 - i), 0
            )
            return { value: seconds, type: 'time' }
        }
        // Weight format: "100kg" or "225lb"
        if (score.match(/kg|lb/i)) {
            return { value: parseFloat(score) || 0, type: 'weight' }
        }
        // Reps or numeric
        return { value: parseFloat(score) || 0, type: 'reps' }
    }

    const toggleAthlete = (athleteId: string) => {
        setExpandedAthletes(prev => ({ ...prev, [athleteId]: !prev[athleteId] }))
    }

    // --- Computed Data: Group by Title -> User -> Logs ---
    const groupedLogs = React.useMemo(() => {
        const groups: Record<string, Record<string, Log[]>> = {}
        logs.forEach(log => {
            if (!groups[log.title]) groups[log.title] = {}
            if (!groups[log.title][log.user_id]) groups[log.title][log.user_id] = []
            groups[log.title][log.user_id].push(log)
        })
        return groups
    }, [logs])

    const unreadCount = notifications.filter(n => !n.is_read).length

    // --- Initial Load (Auth Check) ---
    React.useEffect(() => {
        const stored = localStorage.getItem("ironlens_user")
        if (stored) {
            setCurrentUser(JSON.parse(stored))
        } else {
            window.location.href = "/" // Redirect to login
        }
    }, [])

    // --- Fetch Data ---
    const fetchData = React.useCallback(async () => {
        if (!currentUser) return;
        const dateStr = format(selectedDate, "yyyy-MM-dd")
        const coachId = currentUser.role === 'coach' ? currentUser.id : currentUser.followed_coach_id;

        // Logs
        try {
            const res = await fetch(`${API_BASE_URL}/logs?date=${dateStr}${coachId ? `&coach_id=${coachId}` : ''}`)
            if (res.ok) {
                const fetchedLogs = await res.json()
                setLogs(fetchedLogs)
            }
        } catch (error) { console.error("Failed to fetch logs", error) }

        // Programming
        try {
            const res = await fetch(`${API_BASE_URL}/programming?date=${dateStr}${coachId ? `&coach_id=${coachId}` : ''}`)
            if (res.ok) {
                let data = await res.json()
                // Migration/Safety check for old items
                // @ts-ignore
                data = data.map(item => {
                    if (!item.data) {
                        return {
                            id: Math.random().toString(),
                            name: item.name || "Exercise",
                            type: 'strength',
                            data: [{
                                id: Math.random().toString(),
                                type: 'working',
                                reps: item.sets || "",
                                weight: item.load || "",
                                text: ""
                            }]
                        }
                    }
                    return item
                })

                // Only update if changed to avoid re-renders/closing tabs
                setProgramming(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(data)) {
                        return data
                    }
                    return prev
                })

                // Only sync editor if not currently editing
                if (!isEditingPlan) {
                    setEditedPlan(data)
                }
            }
        } catch (error) { console.error("Failed to fetch programming", error) }

    }, [selectedDate, isEditingPlan, currentUser]) // Added currentUser to ensure refresh on login

    // Sync viewingLog with fresh data when logs change
    React.useEffect(() => {
        if (viewingLog) {
            const freshLog = logs.find(l => l.id === viewingLog.id)
            if (freshLog && JSON.stringify(freshLog) !== JSON.stringify(viewingLog)) {
                setViewingLog(freshLog)
                // Update session context
                const related = logs.filter((l: Log) =>
                    l.user_id === freshLog.user_id && l.title === freshLog.title
                )
                setSessionLogs(related)
            }
        }
    }, [logs])

    const fetchNotifications = React.useCallback(async () => {
        if (!currentUser) return;
        try {
            const res = await fetch(`${API_BASE_URL}/notifications?user_id=${currentUser.id}`)
            if (res.ok) setNotifications(await res.json())
        } catch (error) { console.error("Failed to fetch notifications", error) }
    }, [currentUser])

    React.useEffect(() => {
        fetchData()
        fetchNotifications() // Initial fetch
        const interval = setInterval(() => {
            fetchData()
            fetchNotifications()
        }, 10000) // Poll every 10s
        return () => clearInterval(interval)
    }, [fetchData, fetchNotifications, success])

    // --- Handlers ---

    const toggleFolder = (name: string) => {
        setExpandedFolder(current => current === name ? null : name)
    }

    const handleLogout = () => {
        localStorage.removeItem("ironlens_user")
        window.location.href = "/"
    }

    // --- Coach Access Handlers ---
    const handleSearchCoaches = async () => {
        if (!coachSearchQuery.trim()) return;
        try {
            // Mock search for now - in production this would be a backend endpoint
            const res = await fetch(`${API_BASE_URL}/users?role=coach&query=${coachSearchQuery}`)
            if (res.ok) {
                setFoundCoaches(await res.json())
            }
        } catch (error) { console.error("Failed to search coaches", error) }
    }

    const handleJoinCoach = async () => {
        if (!isJoiningCoach) return;

        const coachCode = isJoiningCoach.access_code;
        const enteredCode = accessCodeInput.trim();

        // Allow if codes match, OR if coach has no code (public)
        if (!coachCode || enteredCode === coachCode) {
            // In a real app, this verification should happen on the backend
            const updatedUser = { ...currentUser!, followed_coach_id: isJoiningCoach.id }
            setCurrentUser(updatedUser)
            localStorage.setItem("ironlens_user", JSON.stringify(updatedUser))

            setIsJoiningCoach(null)
            setAccessCodeInput("")
            setIsCoachSearchOpen(false)

            // PERSIST TO BACKEND
            fetch(`${API_BASE_URL}/users/${currentUser!.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ followed_coach_id: isJoiningCoach.id })
            })

            fetchData() // Refresh with new coach's programming
        } else {
            alert("Incorrect access code!")
        }
    }

    const handleUpdateAccessCode = () => {
        if (!newAccessCode.trim()) return;
        const updatedUser = { ...currentUser!, access_code: newAccessCode }
        setCurrentUser(updatedUser)
        localStorage.setItem("ironlens_user", JSON.stringify(updatedUser))

        // Push to backend
        fetch(`${API_BASE_URL}/users/${currentUser!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_code: newAccessCode })
        })

        setIsSettingAccessCode(false)
        setNewAccessCode("")
    }

    const handleUnfollowCoach = () => {
        const updatedUser = { ...currentUser! }
        delete updatedUser.followed_coach_id
        setCurrentUser(updatedUser)
        localStorage.setItem("ironlens_user", JSON.stringify(updatedUser))
        // PERSIST TO BACKEND
        fetch(`${API_BASE_URL}/users/${currentUser!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followed_coach_id: "null" })
        })

        fetchData()
    }

    const openLogForExercise = (exerciseName: string) => {
        setTitle(exerciseName)

        // --- Smart Set Generation logic ---
        // Find the programming block
        const block = programming.find(p => p.name === exerciseName);
        let initialSets: LogEntrySet[] = [];

        if (block && block.type === 'strength') {
            block.data.forEach(s => {
                if (s.type === 'working') {
                    // Check for batch sets
                    const batchCount = s.target_sets ? parseInt(s.target_sets) : 1;
                    const count = (batchCount > 0) ? batchCount : 1;

                    for (let i = 0; i < count; i++) {
                        initialSets.push({ id: Math.random().toString(), result: "", file: null });
                    }
                }
            });
        }

        // Fallback: If no sets generated (e.g. metcon or no working sets), generate 1
        if (initialSets.length === 0) {
            initialSets.push({ id: "1", result: "", file: null });
        }

        setInputSets(initialSets)

        setEditingLogId(null)
        setSuccess(false)
        setDrawerOpen(true)
    }

    const handleEditLog = (log: Log, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setTitle(log.title)
        setEditingLogId(log.id)
        setEditResult(log.result_score)
        setEditFile(null)
        setRemoveVideo(false)
        setSuccess(false)
        setDrawerOpen(true)
    }

    const handleViewLog = (log: Log) => {
        // Must find all logs for this session to display unified comments
        const related = logs.filter(l => l.user_id === log.user_id && l.title === log.title)
        setSessionLogs(related)
        setViewingLog(log)
        setDetailDrawerOpen(true)
    }



    const handleMarkRead = async () => {
        if (!currentUser) return;
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
        if (unreadIds.length === 0) return;

        await fetch(`${API_BASE_URL}/notifications/mark-read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notification_ids: unreadIds })
        })
        fetchNotifications()
    }

    // --- Multi-Set Form Handlers ---
    const addSet = () => {
        setInputSets([...inputSets, { id: Math.random().toString(), result: "", file: null }])
    }
    const updateSet = (index: number, field: keyof LogEntrySet, value: any) => {
        const newSets = [...inputSets]
        // @ts-ignore
        newSets[index][field] = value
        setInputSets(newSets)
    }
    const removeSet = (index: number) => {
        if (inputSets.length === 1) return;
        setInputSets(inputSets.filter((_, i) => i !== index))
    }

    const handleDeleteLog = async () => {
        if (!confirm("Are you sure you want to delete this log? This cannot be undone.")) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/logs/${editingLogId}?user_id=${currentUser?.id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setDrawerOpen(false);
                setEditingLogId(null);
                fetchData();
            } else {
                alert("Failed to delete log");
            }
        } catch (error) {
            console.error("Delete failed", error);
            alert("Error deleting log");
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleSubmit = async () => {
        if (!currentUser) return;

        setIsSubmitting(true)

        try {
            if (editingLogId) {
                // UPDATE Logic (Single Log)
                const formData = new FormData()
                formData.append("result_score", editResult)
                formData.append("user_id", currentUser.id)
                if (editFile) formData.append("file", editFile)
                formData.append("remove_video", String(removeVideo))

                const response = await fetch(`${API_BASE_URL}/logs/${editingLogId}`, {
                    method: "PUT",
                    body: formData
                })
                if (response.ok) setSuccess(true)

            } else {
                // CREATE Logic
                for (const set of inputSets) {
                    if (!set.result) continue; // Skip empty
                    const formData = new FormData()
                    formData.append("title", title)
                    formData.append("result", set.result)
                    formData.append("user_id", currentUser.id)
                    if (set.file) formData.append("file", set.file)

                    await fetch(`${API_BASE_URL}/analyze`, { method: "POST", body: formData })
                }
                setSuccess(true)
            }

            if (success || !editingLogId) {
                // Trigger Dopamine Bloom 🌸
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#C9FF00', '#FF007A', '#00F0FF', '#FFFFFF']
                });

                setTimeout(() => {
                    setSuccess(false)
                    setDrawerOpen(false)
                }, 1500) // Longer delay to enjoy the confetti
            }

        } catch (e) {
            console.error(e)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleKudos = async (logOrId: Log | string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!currentUser) return
        const logId = typeof logOrId === 'string' ? logOrId : logOrId.id;
        await fetch(`${API_BASE_URL}/logs/${logId}/kudos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: currentUser.id })
        })
        fetchData()
    }

    const handleCaptureFrame = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) {
                    setCommentImage(blob)
                    setCommentImagePreview(URL.createObjectURL(blob))
                }
            }, 'image/jpeg');
        }
    }

    const handleComment = async () => {
        // Comment Logic: We attach the comment to the 'viewingLog' but conceptually it's for the session.
        if (!viewingLog || (!commentText.trim() && !commentImage) || !currentUser) return
        const isCoachFeedback = currentUser.role === 'coach'

        const formData = new FormData();
        formData.append("user_id", currentUser.id);
        formData.append("text", commentText);
        formData.append("is_coach_feedback", String(isCoachFeedback));
        if (commentImage) {
            formData.append("file", commentImage, "frame.jpg");
        }

        await fetch(`${API_BASE_URL}/logs/${viewingLog.id}/comments`, {
            method: "POST",
            body: formData
        })
        setCommentText("")
        setCommentImage(null)
        setCommentImagePreview(null)
        fetchData()
    }

    // --- Programming Editor Handlers ---
    const saveProgramming = async () => {
        if (!currentUser) return;
        const dateStr = format(selectedDate, "yyyy-MM-dd")
        const response = await fetch(`${API_BASE_URL}/programming`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                date: dateStr,
                coach_id: currentUser.id,
                blocks: editedPlan
            })
        })

        if (response.ok) {
            setProgramming(editedPlan)
            setIsEditingPlan(false)
        } else {
            const err = await response.json()
            console.error("Failed to save programming", err)
            alert("Failed to save programming. Please try again.")
        }
    }

    const addBlock = (type: 'strength' | 'metcon') => {
        setEditedPlan([...editedPlan, {
            id: Math.random().toString(),
            name: type === 'strength' ? "New Exercise" : "WOD",
            type: type,
            metcon_type: type === 'metcon' ? 'For Time' : undefined,
            data: []
        }])
    }

    const updateBlock = (index: number, field: keyof ProgrammingBlock, value: any) => {
        const newPlan = [...editedPlan]
        // @ts-ignore
        newPlan[index][field] = value
        setEditedPlan(newPlan)
    }

    const removeBlock = (index: number) => {
        setEditedPlan(editedPlan.filter((_, i) => i !== index))
    }

    const duplicateBlock = (index: number) => {
        const blockToCopy = editedPlan[index]
        const duplicatedBlock = {
            ...blockToCopy,
            id: Math.random().toString(),
            data: blockToCopy.data.map(set => ({ ...set, id: Math.random().toString() }))
        }
        const newPlan = [...editedPlan]
        newPlan.splice(index + 1, 0, duplicatedBlock)
        setEditedPlan(newPlan)
    }

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            setEditedPlan((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id)
                const newIndex = items.findIndex(item => item.id === over.id)
                return arrayMove(items, oldIndex, newIndex)
            })
        }
    }

    const addSetToBlock = (blockIndex: number, type: 'working' | 'warmup' | 'note' | 'movement') => {
        const newPlan = [...editedPlan]
        newPlan[blockIndex].data.push({
            id: Math.random().toString(),
            type,
            reps: "",
            weight: "",
            text: ""
        })
        setEditedPlan(newPlan)
    }

    const updateSetInBlock = (blockIndex: number, setIndex: number, field: keyof ProgrammingSet, value: string) => {
        const newPlan = [...editedPlan]
        // @ts-ignore
        newPlan[blockIndex].data[setIndex][field] = value
        setEditedPlan(newPlan)
    }

    const removeSetFromBlock = (blockIndex: number, setIndex: number) => {
        const newPlan = [...editedPlan]
        newPlan[blockIndex].data = newPlan[blockIndex].data.filter((_, i) => i !== setIndex)
        setEditedPlan(newPlan)
    }


    if (!currentUser) return <div className="min-h-screen bg-black" />

    return (
        <div className="flex min-h-screen flex-col bg-background pb-28">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-white/5">
                <div className="flex items-center justify-between h-16 px-6">
                    <div className="flex items-center gap-2">
                        {/* Brand */}
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                            <Dumbbell className="h-5 w-5 text-black" />
                        </div>
                        <h1 className="text-xl font-black italic tracking-tighter hidden sm:block">
                            IRON<span className="text-primary">LENS</span> <span className="text-[10px] non-italic font-mono text-yellow-500 border border-yellow-500/30 px-1 rounded ml-1">v2.1</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Toggle */}
                        <Button size="icon" variant="ghost" className="md:hidden text-white" onClick={() => setMenuOpen(true)}>
                            <Menu className="h-6 w-6" />
                        </Button>

                        {/* DESKTOP ACTIONS (Hidden on Mobile) */}
                        <div className="hidden md:flex items-center gap-4">
                            {/* Notifications */}
                            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                                <PopoverTrigger asChild>
                                    <button className="relative p-2 rounded-full hover:bg-white/10 transition-colors" onClick={handleMarkRead}>
                                        <Bell className="h-5 w-5 text-muted-foreground" />
                                        {unreadCount > 0 && (
                                            <div className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border border-black animate-pulse" />
                                        )}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0 bg-zinc-950 border-white/10" align="end">
                                    <div className="p-3 border-b border-white/10 font-bold text-sm">Notifications</div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-muted-foreground">No notifications</div>
                                        ) : (
                                            notifications.map(n => (
                                                <div key={n.id} className={cn("flex gap-3 p-3 border-b border-white/5 hover:bg-white/5", !n.is_read && "bg-white/5")}>
                                                    <div className="h-8 w-8 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                                        <img src={n.sender_avatar} className="h-full w-full" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-white leading-tight">{n.message}</p>
                                                        <p className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleTimeString()}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {/* Profile & Access */}
                            <div className="flex items-center gap-3">
                                {currentUser.role === 'athlete' && !currentUser.followed_coach_id && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 gap-2 border-primary/20 hover:border-primary/50 text-xs font-bold"
                                        onClick={() => setIsCoachSearchOpen(true)}
                                    >
                                        <Plus className="h-3.5 w-3.5" /> FIND COACH
                                    </Button>
                                )}
                                {currentUser.role === 'athlete' && currentUser.followed_coach_id && (
                                    <button
                                        onClick={handleUnfollowCoach}
                                        className="text-[10px] text-muted-foreground hover:text-white underline px-2"
                                    >
                                        Unfollow
                                    </button>
                                )}
                                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                                    <div className="h-6 w-6 rounded-full overflow-hidden bg-muted">
                                        <img src={currentUser.avatar_url} alt="" className="h-full w-full" />
                                    </div>
                                    <span className="text-xs font-bold text-white max-w-[100px] truncate">{currentUser.name}</span>
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={handleLogout}>
                                    <LogOut className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                <HorizontalDatePicker selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            </header>

            {/* Coach Mode Banner */}
            {currentUser.role === 'coach' && (
                <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-yellow-500 flex items-center gap-2">
                            <Medal className="h-3 w-3" /> COACH MODE
                        </span>
                        <button
                            onClick={() => setIsSettingAccessCode(true)}
                            className="text-[10px] text-yellow-500/60 hover:text-yellow-500 flex items-center gap-1"
                        >
                            <Pencil className="h-2.5 w-2.5" />
                            Code: {currentUser.access_code || 'None (Public)'}
                        </button>
                    </div>
                    {!isEditingPlan && (
                        <button
                            onClick={() => setIsEditingPlan(true)}
                            className="text-[10px] font-bold bg-yellow-500 text-black px-2 py-1 rounded flex items-center gap-1 hover:bg-yellow-400"
                        >
                            <Edit3 className="h-3 w-3" /> EDIT PROGRAMMING
                        </button>
                    )}
                </div>
            )}

            <main className="flex-1 p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Unified Programming & Feed Section */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between pl-1">
                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                            {format(selectedDate, "EEEE")} Session
                        </h2>

                        {isEditingPlan && (
                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setIsEditingPlan(false)}>Cancel</Button>
                                <Button size="sm" className="h-7 text-xs bg-green-500 hover:bg-green-400 text-black" onClick={saveProgramming}>
                                    <Save className="h-3 w-3 mr-1" /> Save
                                </Button>
                            </div>
                        )}
                    </div>

                    {isEditingPlan ? (
                        // --- Editor Mode ---
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={editedPlan.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-6">
                                    {editedPlan.map((block, i) => (
                                        <SortableBlock
                                            key={block.id}
                                            block={block}
                                            index={i}
                                            updateBlock={updateBlock}
                                            updateSetInBlock={updateSetInBlock}
                                            removeSetFromBlock={removeSetFromBlock}
                                            addSetToBlock={addSetToBlock}
                                            duplicateBlock={duplicateBlock}
                                            removeBlock={removeBlock}
                                        />
                                    ))}

                                    <div className="grid grid-cols-2 gap-4">
                                        <Button variant="outline" className="h-12 border-dashed border-white/20 hover:border-white/50" onClick={() => addBlock('strength')}>
                                            <Plus className="mr-2 h-4 w-4" /> Add Strength
                                        </Button>
                                        <Button variant="outline" className="h-12 border-dashed border-white/20 hover:border-white/50" onClick={() => addBlock('metcon')}>
                                            <Plus className="mr-2 h-4 w-4" /> Add Metcon
                                        </Button>
                                    </div>
                                </div>
                            </SortableContext>
                        </DndContext>
                    ) : (
                        // --- View Mode: Integrated Feed ---
                        <div className="space-y-4">
                            {programming.map((block, i) => {
                                const exerciseLogs = groupedLogs[block.name] || {};
                                const userCount = Object.keys(exerciseLogs).length;
                                const isOpen = expandedFolder === block.name;

                                const isMetcon = block.type === 'metcon';

                                return (
                                    <div key={i} className={cn("rounded-2xl border bg-muted/10 overflow-hidden transition-all", isOpen ? "border-white/20 ring-1 ring-white/10" : "border-white/10")}>
                                        {/* Header / Config */}
                                        <div
                                            onClick={() => toggleFolder(block.name)}
                                            className={cn(
                                                "w-full p-4 cursor-pointer transition-colors hover:bg-white/5 flex flex-col gap-3",
                                                isOpen && "bg-white/5 border-b border-white/10"
                                            )}
                                        >
                                            {/* Row 1: Header (Chevron + Title + Actions) */}
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex gap-4 overflow-hidden min-w-0 pr-2 items-center">
                                                    {/* Check/Play Indicator */}
                                                    <div className={cn("h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition-colors shadow-lg",
                                                        userCount > 0 ? "bg-primary text-black shadow-primary/20" : "bg-muted/30 text-muted-foreground border border-white/5"
                                                    )}>
                                                        {isOpen ? <ChevronUp className="h-5 w-5" /> : (userCount > 0 ? <div className="relative"><ChevronDown className="h-5 w-5 opacity-40" /><Check className="h-3 w-3 text-black absolute -top-1 -right-1" /></div> : <ChevronDown className="h-5 w-5" />)}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start gap-2 flex-wrap">
                                                            {isMetcon ? (
                                                                <span className="text-[9px] font-bold bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded border border-pink-500/20 uppercase tracking-wider shrink-0 mt-0.5">WOD</span>
                                                            ) : (
                                                                <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-wider shrink-0 mt-0.5">LIFT</span>
                                                            )}
                                                            <h3 className={cn("text-lg font-black italic text-white leading-tight break-words min-w-0", isMetcon && "text-pink-100")}>
                                                                {block.name.toLowerCase() === 'wod' ? 'Daily Workout' : block.name}
                                                            </h3>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions: Log Result + User Score + Avatars (Moved to Header) */}
                                                <div className="flex items-center gap-3 shrink-0 ml-auto pl-2">
                                                    {(() => {
                                                        const currentUserLogs = exerciseLogs[currentUser.id];
                                                        if (currentUserLogs && currentUserLogs.length > 0) {
                                                            const parsedScores = currentUserLogs.map(log => ({
                                                                log,
                                                                parsed: parseScore(log.result_score)
                                                            }));
                                                            const scoreType = parsedScores[0]?.parsed.type || 'reps';
                                                            const sorted = [...parsedScores].sort((a, b) => {
                                                                if (scoreType === 'time') {
                                                                    return a.parsed.value - b.parsed.value;
                                                                } else {
                                                                    return b.parsed.value - a.parsed.value;
                                                                }
                                                            });
                                                            const bestScore = sorted[0].log.result_score;
                                                            return (
                                                                <div className="px-3 py-1.5 bg-primary/20 border border-primary/40 rounded-lg">
                                                                    <div className="text-xs font-bold text-primary">
                                                                        {bestScore}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}

                                                    {userCount > 0 && (
                                                        <div className="flex -space-x-2">
                                                            {Object.values(exerciseLogs).slice(0, 3).map(ul => (
                                                                <div key={ul[0].id} className="h-7 w-7 rounded-full ring-2 ring-black bg-slate-700 overflow-hidden">
                                                                    <img src={ul[0].user_avatar} className="h-full w-full object-cover" />
                                                                </div>
                                                            ))}
                                                            {userCount > 3 && (
                                                                <div className="h-7 w-7 rounded-full ring-2 ring-black bg-muted flex items-center justify-center text-[9px] font-bold text-black">
                                                                    +{userCount - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <Button
                                                        size="icon"
                                                        variant="secondary"
                                                        className="h-9 w-9 rounded-full bg-white/10 hover:bg-primary hover:text-black transition-all shadow-xl border border-white/5"
                                                        onClick={(e) => { e.stopPropagation(); openLogForExercise(block.name); }}
                                                    >
                                                        <Plus className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Row 2: Full Width Content */}
                                            {!isOpen && (
                                                <div className="w-full text-sm text-zinc-300 font-mono leading-tight space-y-0.5 pl-[3.5rem]"> {/* Indented to align with text */}
                                                    {isMetcon ? (
                                                        <div className="flex flex-col gap-0.5 text-pink-200/90 whitespace-pre-line">
                                                            {(block.description || block.metcon_type)?.split('\n').map((line, idx) => (
                                                                <div key={idx} className="leading-snug">
                                                                    {line}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-0.5">
                                                            {block.data.filter(s => s.type !== 'warmup' && s.type !== 'movement').map((set, idx) => {
                                                                const isNote = set.type?.toLowerCase() === 'note';
                                                                return (
                                                                    <div key={idx} className="text-white flex items-center gap-2">
                                                                        {isNote ? (
                                                                            <span className="text-sm text-yellow-500 font-medium block">
                                                                                {set.text || <span className="opacity-50 italic">Empty Note</span>}
                                                                            </span>
                                                                        ) : (
                                                                            <>
                                                                                {set.target_sets && parseInt(set.target_sets) > 1 && (
                                                                                    <>
                                                                                        <span className="font-bold text-white">{set.target_sets}</span>
                                                                                        <span className="text-muted-foreground text-xs mx-1">x</span>
                                                                                    </>
                                                                                )}
                                                                                <span>{set.reps} <span className="text-muted-foreground">@</span> {set.weight}</span>
                                                                                {set.text && <span className="text-xs text-yellow-500/80 font-sans italic">// {set.text}</span>}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Expanded Content */}
                                        <AnimatePresence>
                                            {isOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="border-t border-white/5 bg-background/50">
                                                        {/* Metcon Description (Still valuable to show fully if expanding) */}
                                                        {isMetcon && (
                                                            <div className="p-6 pb-0">
                                                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-4">
                                                                    <Dumbbell className="h-3 w-3" /> Workout Details
                                                                </h4>
                                                                <div className="font-mono text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                                                                    {block.description || "No details available."}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* NOTE: Strength sets are now fully visible in the collapsed card body, so we hide them here to avoid duplication. */}


                                                        {/* Community Activity / Leaderboard */}
                                                        <div className="px-6 pb-6">
                                                            <div className="flex items-center gap-4 mb-4">
                                                                <div className="h-px flex-1 bg-white/10" />
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                                    <Medal className="h-3 w-3" /> Community Session Activity
                                                                </span>
                                                                <div className="h-px flex-1 bg-white/10" />
                                                            </div>

                                                            {userCount === 0 ? (
                                                                <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl">
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">First to move wins! 🏆</p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    {(() => {
                                                                        // Calculate Leaderboard Data for this block
                                                                        const userLeaderboardData = Object.entries(exerciseLogs).map(([userId, userLogs]) => {
                                                                            const parsedScores = userLogs.map(log => ({
                                                                                log,
                                                                                parsed: parseScore(log.result_score)
                                                                            }));
                                                                            const scoreType = parsedScores[0]?.parsed.type || 'reps';
                                                                            const sorted = [...parsedScores].sort((a, b) => {
                                                                                if (scoreType === 'time') return a.parsed.value - b.parsed.value;
                                                                                return b.parsed.value - a.parsed.value;
                                                                            });
                                                                            return {
                                                                                userId,
                                                                                bestLog: sorted[0].log,
                                                                                userLogs: userLogs,
                                                                                user_name: userLogs[0].user_name,
                                                                                user_avatar: userLogs[0].user_avatar
                                                                            };
                                                                        }).sort((a, b) => {
                                                                            const scoreA = parseScore(a.bestLog.result_score);
                                                                            const scoreB = parseScore(b.bestLog.result_score);
                                                                            if (scoreA.type === 'time') return scoreA.value - scoreB.value;
                                                                            return scoreB.value - scoreA.value;
                                                                        });

                                                                        return userLeaderboardData.map((data, rankIdx) => {
                                                                            const isCurrentUser = data.userId === currentUser?.id;
                                                                            const isOpen = expandedAthletes[data.userId] || false;
                                                                            const rank = rankIdx + 1;

                                                                            return (
                                                                                <motion.div
                                                                                    layout
                                                                                    key={data.userId}
                                                                                    className={cn(
                                                                                        "rounded-xl border transition-all overflow-hidden",
                                                                                        isCurrentUser ? "bg-primary/5 border-primary/20" : "bg-white/5 border-white/5"
                                                                                    )}
                                                                                >
                                                                                    {/* Athlete Header - Collapsible Trigger */}
                                                                                    <div
                                                                                        onClick={() => setExpandedAthletes(prev => ({ ...prev, [data.userId]: !isOpen }))}
                                                                                        className="p-4 cursor-pointer flex items-center justify-between hover:bg-white/5 transition-colors"
                                                                                    >
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="relative">
                                                                                                <div className="h-10 w-10 rounded-full border border-white/10 overflow-hidden shadow-lg">
                                                                                                    <img src={data.user_avatar} alt={data.user_name} className="h-full w-full object-cover" />
                                                                                                </div>
                                                                                                {rank <= 3 && (
                                                                                                    <div className={cn(
                                                                                                        "absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center border text-[10px] font-bold shadow-2xl",
                                                                                                        rank === 1 ? "bg-yellow-500 border-yellow-300 text-black animate-pulse" :
                                                                                                            rank === 2 ? "bg-zinc-300 border-white text-black" :
                                                                                                                "bg-orange-600 border-orange-400 text-white"
                                                                                                    )}>
                                                                                                        {rank === 1 ? "1" : rank === 2 ? "2" : "3"}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="flex flex-col">
                                                                                                <span className="text-xs font-black text-white italic tracking-tight">{data.user_name} {isCurrentUser && "(YOU)"}</span>
                                                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5 mt-0.5">
                                                                                                    {data.userLogs.length} SETS • BEST: <span className="text-primary">{data.bestLog.result_score}</span>
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>

                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="flex flex-col items-end">
                                                                                                <div className="text-sm font-mono font-black text-white">{data.bestLog.result_score}</div>
                                                                                                <div className="text-[8px] font-bold text-muted-foreground uppercase">PR SCORE</div>
                                                                                            </div>
                                                                                            {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Expanded Sets Grid */}
                                                                                    <AnimatePresence>
                                                                                        {isOpen && (
                                                                                            <motion.div
                                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                                animate={{ height: "auto", opacity: 1 }}
                                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                                                                className="border-t border-white/5 bg-black/30 p-4"
                                                                                            >
                                                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                                                                                    {data.userLogs.map((log) => {
                                                                                                        const showThumbnail = !!log.thumbnail_url;
                                                                                                        return (
                                                                                                            <div
                                                                                                                key={log.id}
                                                                                                                className="relative group bg-muted/20 rounded-xl overflow-hidden border border-white/5 hover:border-primary/50 transition-all cursor-pointer aspect-[3/4] shadow-xl"
                                                                                                                onClick={() => handleViewLog(log)}
                                                                                                            >
                                                                                                                <div className="w-full h-full relative">
                                                                                                                    {showThumbnail ? (
                                                                                                                        <img src={log.thumbnail_url!} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                                                                                                    ) : log.video_url && (
                                                                                                                        <video src={log.video_url} className="w-full h-full object-cover" />
                                                                                                                    )}

                                                                                                                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

                                                                                                                    {/* LARGER SCORES WHEN EXPANDED */}
                                                                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                                                                                                                        <div className="text-lg font-black text-white italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none tracking-tighter">
                                                                                                                            {log.result_score}
                                                                                                                        </div>
                                                                                                                    </div>

                                                                                                                    <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between text-[7px] font-black uppercase tracking-widest text-white/40">
                                                                                                                        <button
                                                                                                                            onClick={(e) => { e.stopPropagation(); handleKudos(log.id, e); }}
                                                                                                                            className={cn(
                                                                                                                                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-all duration-300",
                                                                                                                                log.kudos_count > 0 ? "text-primary bg-primary/10 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "hover:text-white"
                                                                                                                            )}
                                                                                                                        >
                                                                                                                            <ThumbsUp className={cn("h-2 w-2", log.kudos_count > 0 && "fill-primary")} /> {log.kudos_count}
                                                                                                                        </button>
                                                                                                                        <div className="flex items-center gap-0.5">
                                                                                                                            <MessageSquare className="h-2 w-2" /> {log.comments.length}
                                                                                                                        </div>
                                                                                                                    </div>

                                                                                                                    {currentUser.id === log.user_id && (
                                                                                                                        <button
                                                                                                                            onClick={(e) => { e.stopPropagation(); handleEditLog(log, e); }}
                                                                                                                            className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-white text-white hover:text-black rounded-full transition-colors z-10"
                                                                                                                        >
                                                                                                                            <Pencil className="h-2.5 w-2.5" />
                                                                                                                        </button>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        )
                                                                                                    })}
                                                                                                </div>
                                                                                            </motion.div>
                                                                                        )}
                                                                                    </AnimatePresence>
                                                                                </motion.div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )
                            })}

                            {/* Other Work Section (Logs not in Programming) */}
                            {Object.entries(groupedLogs)
                                .filter(([title, userGroups]) => {
                                    // 1. Must not be in current programming
                                    const isprogramming = programming.some(p => p.name === title);
                                    if (isprogramming) return false;

                                    // 2. Ghost Fix: ONLY show if CURRENT USER has logs in this group
                                    // The global group might exist because other users logged it, but we only want to show it 
                                    // in "Other Work" if the user themselves did it.
                                    const userHasLogs = currentUser && userGroups[currentUser.id] && userGroups[currentUser.id].length > 0;

                                    // DEBUG: Trace why folders are showing
                                    if (title === 'test') {
                                        console.log('Ghost Debug:', {
                                            title,
                                            currentUserId: currentUser?.id,
                                            hasLogs: userHasLogs,
                                            userKeys: Object.keys(userGroups)
                                        });
                                    }

                                    return userHasLogs;
                                })
                                .map(([title, userGroups]) => {
                                    const userCount = Object.keys(userGroups).length;
                                    const isOpen = expandedFolder === title;
                                    return (
                                        <div key={title} className="rounded-2xl border border-white/5 bg-muted/5 overflow-hidden">
                                            <div
                                                onClick={() => toggleFolder(title)}
                                                className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-muted/20 flex items-center justify-center text-muted-foreground">
                                                        <FolderOpen className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white/80 leading-none mb-1">{title}</h3>
                                                        <p className="text-xs text-muted-foreground">Extra Work</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                                                </div>
                                            </div>
                                            {isOpen && (
                                                <div className="p-3 space-y-2 bg-black/20">
                                                    {(() => {
                                                        const userLeaderboardData = Object.entries(userGroups).map(([userId, userLogs]) => {
                                                            const parsedScores = userLogs.map(log => ({
                                                                log,
                                                                parsed: parseScore(log.result_score)
                                                            }));
                                                            const scoreType = parsedScores[0]?.parsed.type || 'reps';
                                                            const sorted = [...parsedScores].sort((a, b) => {
                                                                if (scoreType === 'time') return a.parsed.value - b.parsed.value;
                                                                return b.parsed.value - a.parsed.value;
                                                            });
                                                            return {
                                                                userId,
                                                                bestLog: sorted[0].log,
                                                                userLogs: userLogs,
                                                                user_name: userLogs[0].user_name,
                                                                user_avatar: userLogs[0].user_avatar
                                                            };
                                                        }).sort((a, b) => {
                                                            const scoreA = parseScore(a.bestLog.result_score);
                                                            const scoreB = parseScore(b.bestLog.result_score);
                                                            if (scoreA.type === 'time') return scoreA.value - scoreB.value;
                                                            return scoreB.value - scoreA.value;
                                                        });

                                                        return userLeaderboardData.map((data, rankIdx) => {
                                                            const isCurrentUser = data.userId === currentUser?.id;
                                                            const isOpen = expandedAthletes[data.userId] || false;
                                                            const rank = rankIdx + 1;

                                                            return (
                                                                <motion.div
                                                                    layout
                                                                    key={data.userId}
                                                                    className={cn(
                                                                        "rounded-xl border transition-all overflow-hidden",
                                                                        isCurrentUser ? "bg-primary/5 border-primary/20" : "bg-white/5 border-white/5"
                                                                    )}
                                                                >
                                                                    <div
                                                                        onClick={() => toggleAthlete(data.userId)}
                                                                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5"
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="relative">
                                                                                <div className="h-10 w-10 rounded-full border-2 border-white/10 overflow-hidden shadow-xl ring-2 ring-black">
                                                                                    <img src={data.user_avatar} alt={data.user_name} className="h-full w-full object-cover" />
                                                                                </div>
                                                                                {rank <= 3 && (
                                                                                    <div className={cn(
                                                                                        "absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center border text-[10px] font-bold shadow-2xl",
                                                                                        rank === 1 ? "bg-yellow-500 border-yellow-300 text-black animate-pulse" :
                                                                                            rank === 2 ? "bg-zinc-300 border-white text-black" :
                                                                                                "bg-orange-600 border-orange-400 text-white"
                                                                                    )}>
                                                                                        {rank === 1 ? "1" : rank === 2 ? "2" : "3"}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-xs font-black text-white italic tracking-tight">{data.user_name} {isCurrentUser && "(YOU)"}</span>
                                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5 mt-0.5">
                                                                                    {data.userLogs.length} SETS • BEST: <span className="text-primary">{data.bestLog.result_score}</span>
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-3">
                                                                            <div className="flex flex-col items-end">
                                                                                <div className="text-sm font-mono font-black text-white">{data.bestLog.result_score}</div>
                                                                                <div className="text-[8px] font-bold text-muted-foreground uppercase">PR SCORE</div>
                                                                            </div>
                                                                            {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                                                        </div>
                                                                    </div>

                                                                    <AnimatePresence>
                                                                        {isOpen && (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: "auto", opacity: 1 }}
                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                className="border-t border-white/5 bg-black/30 p-3"
                                                                            >
                                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                                                                    {data.userLogs.map((log) => (
                                                                                        <div
                                                                                            key={log.id}
                                                                                            className="relative group bg-muted/20 rounded-xl overflow-hidden border border-white/5 hover:border-primary/50 transition-all cursor-pointer aspect-[3/4] shadow-xl"
                                                                                            onClick={() => handleViewLog(log)}
                                                                                        >
                                                                                            <div className="w-full h-full relative">
                                                                                                {log.thumbnail_url ? (
                                                                                                    <img src={log.thumbnail_url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                                                                                ) : log.video_url && (
                                                                                                    <video src={log.video_url} className="w-full h-full object-cover" />
                                                                                                )}
                                                                                                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                                                                                                    IronLens <span className="text-xs text-yellow-500 font-mono border border-yellow-500/30 px-1 rounded">v2.1</span>
                                                                                                </h1>                                                                                                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
                                                                                                <div className="absolute inset-0 flex items-center justify-center p-2">
                                                                                                    <div className="text-lg font-black text-white italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none">
                                                                                                        {log.result_score}
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between text-[7px] font-black uppercase tracking-widest text-white/40">
                                                                                                    <button
                                                                                                        onClick={(e) => { e.stopPropagation(); handleKudos(log.id, e); }}
                                                                                                        className={cn(
                                                                                                            "flex items-center gap-0.5 px-1 rounded-full transition-all duration-300",
                                                                                                            log.kudos_count > 0 ? "text-primary bg-primary/10 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "hover:text-white"
                                                                                                        )}
                                                                                                    >
                                                                                                        <ThumbsUp className={cn("h-2 w-2", log.kudos_count > 0 && "fill-primary")} /> {log.kudos_count}
                                                                                                    </button>
                                                                                                    <div className="flex items-center gap-0.5">
                                                                                                        <MessageSquare className="h-2 w-2" /> {log.comments.length}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </motion.div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                        </div>
                    )}
                </section>

            </main>

            {/* Create/Edit Log Drawer */}
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DrawerContent className="bg-background border-t border-white/10 max-h-[90dvh]">
                    <div className="mx-auto w-full max-w-sm">
                        <DrawerHeader>
                            <DrawerTitle>{editingLogId ? "Edit Set" : `Log - ${title}`}</DrawerTitle>
                        </DrawerHeader>
                        <div className="p-6 max-h-[75dvh] overflow-y-auto space-y-6 pb-40">

                            {editingLogId ? (
                                // --- EDIT SINGLE LOG MODE ---
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground">RESULT</label>
                                        <Input
                                            placeholder="e.g. 100kg"
                                            value={editResult}
                                            onChange={e => setEditResult(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground">VIDEO</label>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Input
                                                type="file"
                                                accept="video/*"
                                                onChange={e => { setEditFile(e.target.files?.[0] || null); setRemoveVideo(false) }}
                                                disabled={removeVideo}
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="removeVideo"
                                                checked={removeVideo}
                                                onChange={e => setRemoveVideo(e.target.checked)}
                                                className="rounded border-white/20 bg-muted"
                                            />
                                            <label htmlFor="removeVideo" className="text-xs text-red-400">Remove existing video</label>
                                        </div>
                                    </div>

                                    <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                                        {isSubmitting ? "Updating..." : "Update Set"}
                                    </Button>

                                    <Button variant="destructive" className="w-full" onClick={handleDeleteLog} disabled={isSubmitting}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Log
                                    </Button>
                                </div>
                            ) : (
                                // --- CREATE MULTI-SET MODE ---
                                <div className="space-y-4">
                                    {inputSets.map((set, index) => (
                                        <div key={set.id} className="p-3 bg-muted/10 rounded-xl border border-white/5 space-y-3 relative">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-muted-foreground">SET {index + 1}</span>
                                                {inputSets.length > 1 && (
                                                    <button onClick={() => removeSet(index)} className="text-muted-foreground hover:text-red-500">
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <Input
                                                placeholder="Result (e.g. 10 reps)"
                                                value={set.result}
                                                onChange={e => updateSet(index, 'result', e.target.value)}
                                            />
                                            <Input
                                                type="file"
                                                accept="video/*"
                                                onChange={e => updateSet(index, 'file', e.target.files?.[0] || null)}
                                            />
                                        </div>
                                    ))}

                                    <Button variant="outline" className="w-full border-dashed" onClick={addSet}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Another Set
                                    </Button>

                                    <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                                        {isSubmitting ? "Saving All..." : "Save Logs"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            {/* View Detail Drawer (Comments/Video) */}
            <div className="fixed inset-0 z-40 pointer-events-none">
                <Drawer open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
                    <DrawerContent className="bg-background border-t border-white/10 max-h-[85dvh] h-[85dvh] flex flex-col pointer-events-auto">
                        {viewingLog && (
                            <div className="mx-auto w-full max-w-md flex flex-col h-full min-h-0">
                                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-slate-700 overflow-hidden">
                                            <img src={viewingLog.user_avatar} className="h-full w-full" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-white">{viewingLog.user_name}</h4>
                                            <p className="text-xs text-muted-foreground">Session Analysis • {viewingLog.title}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleKudos(viewingLog.id)}
                                        className={cn(
                                            "transition-all duration-300 gap-2 px-3",
                                            viewingLog.kudos_count > 0 ? "text-primary bg-primary/10 shadow-[0_0_15px_rgba(34,197,94,0.3)]" : "text-muted-foreground"
                                        )}
                                    >
                                        <ThumbsUp className={cn("h-4 w-4 shrink-0", viewingLog.kudos_count > 0 && "fill-primary")} />
                                        <span className="font-bold">
                                            {viewingLog.kudos_count > 0 ? `${viewingLog.kudos_count} KUDOS` : "KUDOS"}
                                        </span>
                                    </Button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                    {/* Selected Video Player */}
                                    {viewingLog.video_url && (
                                        <div className="rounded-xl overflow-hidden bg-black aspect-video border border-white/10 relative shadow-2xl flex items-center justify-center">
                                            <canvas ref={canvasRef} className="hidden" />
                                            <video
                                                ref={videoRef}
                                                src={viewingLog.video_url}
                                                className="w-full h-full object-contain"
                                                controls
                                                autoPlay
                                                playsInline
                                                crossOrigin="anonymous"
                                            />

                                            {/* Frame Capture Button (Coach Only) */}
                                            {currentUser?.role === 'coach' && (
                                                <button
                                                    onClick={handleCaptureFrame}
                                                    className="absolute bottom-16 right-4 sm:bottom-4 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs rounded-full shadow-lg flex items-center gap-1 z-20 transition-transform active:scale-95"
                                                >
                                                    <Camera className="h-3 w-3" /> Snap Frame
                                                </button>
                                            )}

                                            <div className="absolute top-4 left-4 px-3 py-1 bg-black/70 backdrop-blur rounded text-sm font-bold text-white z-10">
                                                {viewingLog.result_score}
                                            </div>
                                        </div>
                                    )}

                                    {/* Session Strip (Other Sets) */}
                                    <div className="space-y-2">
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Session Sets</h5>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {sessionLogs.map(l => (
                                                <button
                                                    key={l.id}
                                                    onClick={() => setViewingLog(l)}
                                                    className={cn(
                                                        "relative h-16 w-12 rounded overflow-hidden border shrink-0 transition-all",
                                                        viewingLog.id === l.id ? "border-primary ring-1 ring-primary" : "border-white/10 hover:border-white/30"
                                                    )}
                                                >
                                                    {l.thumbnail_url ? (
                                                        <img src={l.thumbnail_url} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="h-full w-full bg-muted flex items-center justify-center"><VideoOff className="h-3 w-3" /></div>
                                                    )}
                                                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-center text-white py-0.5 truncate">
                                                        {l.result_score}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Unified Session Comments */}
                                    <div className="space-y-3 pb-20">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Session Discussion</h4>
                                        {sessionLogs.flatMap(l => l.comments).length === 0 ? (
                                            <p className="text-sm text-muted-foreground italic">No comments yet.</p>
                                        ) : (
                                            sessionLogs.flatMap(l => l.comments)
                                                .sort((a, b) => {
                                                    // Sort: Coach first, then chronological
                                                    if (a.is_coach_feedback !== b.is_coach_feedback) return a.is_coach_feedback ? -1 : 1;
                                                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                                                })
                                                .map(c => (
                                                    <div key={c.id} className={cn("text-sm p-4 rounded-xl", c.is_coach_feedback ? "border-l-4 border-yellow-500 bg-yellow-500/10" : "bg-white/5")}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-slate-700 overflow-hidden">
                                                                    <img src={c.user_avatar} className="h-full w-full" />
                                                                </div>
                                                                <span className={cn("font-bold text-xs", c.is_coach_feedback ? "text-yellow-500 uppercase tracking-wider" : "text-white")}>
                                                                    {c.user_name}
                                                                    {c.is_coach_feedback && <span className="ml-2 text-[8px] bg-yellow-500 text-black px-1 rounded-sm">COACH</span>}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>

                                                        {/* Text Content */}
                                                        <p className={cn("ml-8", c.is_coach_feedback ? "text-white font-medium" : "text-muted-foreground")}>{c.text}</p>

                                                        {/* Image Attachment */}
                                                        {/* @ts-ignore */}
                                                        {c.image_url && (
                                                            <div className="ml-8 mt-2 rounded-lg overflow-hidden border border-white/10 w-48 shadow-lg cursor-pointer hover:opacity-90 transition-opacity">
                                                                {/* @ts-ignore */}
                                                                <img src={c.image_url} alt="Feedback" className="w-full h-auto" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>

                                {/* Add Comment Footer */}
                                <div className="p-4 border-t border-white/10 bg-background pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-3 shrink-0 z-50">
                                    {/* Image Preview */}
                                    {commentImagePreview && (
                                        <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-yellow-500/50 group">
                                            <img src={commentImagePreview} className="w-full h-full object-cover" />
                                            <button onClick={() => { setCommentImage(null); setCommentImagePreview(null) }} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500"><X className="h-3 w-3" /></button>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Input
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder={currentUser?.role === 'coach' ? "Coach feedback..." : "Add a comment..."}
                                            className={cn("h-10 bg-muted/20 text-base md:text-sm", currentUser?.role === 'coach' && "border-yellow-500/30 focus-visible:ring-yellow-500 font-medium")}
                                            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                                        />
                                        <Button size="icon" onClick={handleComment} disabled={!commentText.trim() && !commentImage} className={cn(currentUser?.role === 'coach' ? "bg-yellow-500 text-black hover:bg-yellow-400" : "")}>
                                            <MessageSquare className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DrawerContent>
                </Drawer>
            </div>

            {/* Coach Search Drawer */}
            <Drawer open={isCoachSearchOpen} onOpenChange={setIsCoachSearchOpen}>
                <DrawerContent className="bg-zinc-950 border-white/10 max-h-[90dvh]">
                    <DrawerHeader>
                        <DrawerTitle className="text-xl font-bold italic">FIND A COACH</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-6 space-y-6">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Search by name..."
                                value={coachSearchQuery}
                                onChange={(e) => setCoachSearchQuery(e.target.value)}
                                className="bg-white/5 border-white/10"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearchCoaches()}
                            />
                            <Button onClick={handleSearchCoaches}>
                                <Search className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="space-y-3 max-h-[60dvh] overflow-y-auto pb-40">
                            {foundCoaches.length === 0 ? (
                                <p className="text-center text-muted-foreground py-10 text-sm italic">Search to find coaches and follow their programming.</p>
                            ) : (
                                foundCoaches.map(coach => (
                                    <div key={coach.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-700">
                                                <img src={coach.avatar_url} className="h-full w-full object-cover" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white leading-tight">{coach.name}</h4>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Certified Coach</p>
                                            </div>
                                        </div>

                                        {isJoiningCoach?.id === coach.id ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    placeholder="Code"
                                                    value={accessCodeInput}
                                                    onChange={(e) => setAccessCodeInput(e.target.value)}
                                                    className="w-24 h-8 text-xs outline-primary border-primary/50 text-center"
                                                    type="password"
                                                />
                                                <Button size="sm" onClick={handleJoinCoach} className="h-8 bg-primary text-black hover:bg-primary/90 font-bold px-4">
                                                    JOIN
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => setIsJoiningCoach(coach)}
                                                className="bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 font-bold"
                                            >
                                                FOLLOW
                                            </Button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Coach Access Code Settings Drawer */}
            <Drawer open={isSettingAccessCode} onOpenChange={setIsSettingAccessCode}>
                <DrawerContent className="bg-zinc-950 border-white/10">
                    <DrawerHeader>
                        <DrawerTitle className="text-xl font-bold italic">PROGRAMMING ACCESS CODE</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-6 space-y-4">
                        <p className="text-xs text-muted-foreground">
                            Set a unique password for your coaching. People who want to access your specific training will need to enter this code.
                        </p>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Your Code</label>
                            <Input
                                placeholder="Enter a code (e.g. IRON123)"
                                value={newAccessCode}
                                onChange={(e) => setNewAccessCode(e.target.value)}
                                className="bg-white/5 border-white/10 text-lg font-mono tracking-widest text-primary"
                            />
                        </div>
                        <Button className="w-full bg-primary text-black hover:bg-primary/90 font-bold" onClick={handleUpdateAccessCode}>
                            SAVE ACCESS CODE
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center italic">
                            Leave empty to make your programming public to anyone who finds you.
                        </p>
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Mobile Navigation Drawer */}
            <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
                <DrawerContent className="bg-background border-t border-white/10">
                    <div className="mx-auto w-full max-w-sm p-6 space-y-6">
                        {/* Profile Header */}
                        <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                            <div className="h-12 w-12 rounded-full overflow-hidden bg-muted border-2 border-white/10">
                                <img src={currentUser.avatar_url} className="h-full w-full object-cover" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{currentUser.name}</h3>
                                <p className="text-xs text-muted-foreground uppercase">{currentUser.role === 'coach' ? 'Coach' : 'Athlete'}</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            {/* Notifications Item */}
                            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                                <span className="text-sm font-medium">Notifications</span>
                                <div className="flex items-center gap-2">
                                    {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{unreadCount}</span>}
                                    <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                                        <PopoverTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-8"><Bell className="h-4 w-4" /></Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-0 bg-zinc-950 border-white/10" align="end">
                                            <div className="p-3 border-b border-white/10 font-bold text-sm">Notifications</div>
                                            <div className="max-h-60 overflow-y-auto">
                                                {notifications.length === 0 ? <div className="p-4 text-xs text-muted-foreground">None</div> : notifications.map(n => (
                                                    <div key={n.id} className="p-3 border-b border-white/5 text-xs text-white">{n.message}</div>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {currentUser.role === 'athlete' && !currentUser.followed_coach_id && (
                                <Button
                                    variant="outline"
                                    className="w-full justify-start h-12 text-sm font-bold"
                                    onClick={() => { setMenuOpen(false); setIsCoachSearchOpen(true); }}
                                >
                                    <Plus className="mr-2 h-4 w-4" /> FIND A COACH
                                </Button>
                            )}

                            {currentUser.role === 'athlete' && currentUser.followed_coach_id && (
                                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                                    <span className="text-sm font-bold text-primary">Coach Connected</span>
                                    <button onClick={handleUnfollowCoach} className="text-xs text-muted-foreground underline">Unfollow</button>
                                </div>
                            )}

                            {currentUser.role === 'coach' && (
                                <Button
                                    className="w-full justify-start h-12 text-sm font-bold bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30"
                                    onClick={() => { setMenuOpen(false); setIsSettingAccessCode(true); }}
                                >
                                    <Pencil className="mr-2 h-4 w-4" /> Manage Access Code
                                </Button>
                            )}
                        </div>

                        {/* Logout */}
                        <Button variant="destructive" className="w-full h-12 font-bold" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" /> Log Out
                        </Button>
                    </div>
                </DrawerContent>
            </Drawer>

        </div >
    )
}
