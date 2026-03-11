import { useState, useEffect, useRef } from 'react';
import {
    Moon,
    Sun,
    Zap,
    Layout,
    Target,
    Archive,
    Search,
    CheckCircle2,
    ArrowRight,
    Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';

interface CommandItem {
    id: string;
    title: string;
    shortcut?: string;
    icon: React.ElementType;
    action: () => void;
    category: string;
}

export function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { mode, setMode } = useTheme();
    const { activeView, setActiveView, toggleTask, committedTasks, selectedInboxId, bringForward } = useApp();
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const commands: CommandItem[] = [
        // Views
        { id: 'view-flow', title: "Open Today's Commit", icon: Zap, category: 'Navigation', action: () => setActiveView('flow') },
        { id: 'view-goals', title: 'Open Weekly Intentions', icon: Target, category: 'Navigation', action: () => setActiveView('goals') },
        { id: 'view-archive', title: 'Open Archive', icon: Archive, category: 'Navigation', action: () => setActiveView('archive') },

        // Themes
        { id: 'theme-dark', title: 'Dark Mode', icon: Moon, category: 'Theme', action: () => setMode('dark') },
        { id: 'theme-light', title: 'Light Mode', icon: Sun, category: 'Theme', action: () => setMode('light') },
        { id: 'theme-focus', title: 'Quiet Focus', icon: Layout, category: 'Theme', action: () => setMode('focus') },

        // Actions
        { id: 'action-done', title: 'Mark active task done', icon: CheckCircle2, category: 'Action', action: () => { const active = committedTasks.find(t => t.active && t.status !== 'done'); if (active) toggleTask(active.id); } },
        { id: 'action-bring-forward', title: 'Bring forward from inbox', icon: ArrowRight, category: 'Action', action: () => { if (selectedInboxId) bringForward(selectedInboxId); } },
        { id: 'action-start-focus', title: 'Start focus block', icon: Play, category: 'Action', action: () => { const active = committedTasks.find(t => t.active && t.status !== 'done'); if (active) { void window.api.window.showPomodoro(); void window.api.pomodoro.start(active.id, active.title); } } },
    ];

    const filteredCommands = commands.filter(cmd =>
        cmd.title.toLowerCase().includes(query.toLowerCase()) ||
        cmd.category.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    const handleSelect = (index: number) => {
        const cmd = filteredCommands[index];
        if (cmd) {
            cmd.action();
            setIsOpen(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect(selectedIndex);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-black/40 animate-fade-in duration-200">
            <div
                ref={menuRef}
                className="w-full max-w-[600px] bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
                onKeyDown={handleKeyDown}
            >
                {/* Search */}
                <div className="flex items-center px-4 border-b border-border">
                    <Search className="w-5 h-5 text-text-muted" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent border-none outline-none py-5 px-3 text-[16px] text-text-primary placeholder:text-text-muted font-sans"
                        placeholder="Where do you want to go?"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                    />
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-elevated border border-border-subtle text-text-muted text-[11px] font-mono">
                        <span>ESC</span>
                    </div>
                </div>

                {/* Results */}
                <div className="max-h-[400px] overflow-y-auto p-2 flex flex-col hide-scrollbar">
                    {filteredCommands.length === 0 ? (
                        <div className="py-12 text-center text-text-muted text-[14px]">
                            Nothing matches "{query}"
                        </div>
                    ) : (
                        filteredCommands.map((cmd, i) => {
                            const isSelected = i === selectedIndex;
                            const isActive = (cmd.id === `view-${activeView}`) || (cmd.id === `theme-${mode}`);

                            return (
                                <div
                                    key={cmd.id}
                                    onClick={() => handleSelect(i)}
                                    onMouseEnter={() => setSelectedIndex(i)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-3 rounded-md cursor-pointer transition-all duration-200",
                                        isSelected ? "bg-bg-elevated" : "hover:bg-bg-elevated/50"
                                    )}
                                >
                                    <div className={cn(
                                        "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                                        isSelected ? "bg-bg-card border border-border-subtle text-text-primary" : "text-text-muted"
                                    )}>
                                        <cmd.icon className="w-5 h-5" />
                                    </div>

                                    <div className="flex-1 flex flex-col">
                                        <span className={cn(
                                            "text-[14px] font-medium",
                                            isSelected ? "text-text-emphasis" : "text-text-primary"
                                        )}>
                                            {cmd.title}
                                        </span>
                                        <span className="text-[11px] text-text-muted">
                                            {cmd.category}
                                        </span>
                                    </div>

                                    {isActive && (
                                        <CheckCircle2 className="w-4 h-4 text-done opacity-60" />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-bg-elevated/30 border-t border-border flex items-center justify-between text-text-muted text-[11px] font-mono">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <span className="px-1 py-0.5 rounded border border-border bg-bg-card">↓</span>
                            <span className="px-1 py-0.5 rounded border border-border bg-bg-card">↑</span>
                            to move
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="px-1 py-0.5 rounded border border-border bg-bg-card">↵</span>
                            to choose
                        </span>
                    </div>
                    <div>{filteredCommands.length} available</div>
                </div>
            </div>
        </div>
    );
}
