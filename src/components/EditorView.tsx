import React, { useState, useEffect } from 'react';
import { Clock, BarChart3, ChevronLeft, PlusCircle, History, Menu, Sun, Moon, Trash2, Play, Pause } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import TiptapEditor from './TiptapEditor';
import { useProjectStore, Scene, Session } from '../store/useProjectStore';

const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const EditorView: React.FC = () => {
    // Get state and actions directly from the Zustand store
    const {
        currentProject,
        activeSceneId,
        editorContent,
        setCurrentProject,
        createNewScene,
        reorderScenes,
        renameScene,
        deleteScene,
        setActiveSceneId,
        setEditorContent,
        updateSceneContent,
        addSession
    } = useProjectStore();

    // UI-specific state remains local to this component
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [showStats, setShowStats] = useState(false);
    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [editingSceneTitle, setEditingSceneTitle] = useState('');
    const [showDeleteSceneModal, setShowDeleteSceneModal] = useState<Scene | null>(null);

    // Session-specific state remains local
    const [isWriting, setIsWriting] = useState(false);
    const [sessionTime, setSessionTime] = useState(0);
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [initialWordCount, setInitialWordCount] = useState(0);

    // --- Effects ---
    useEffect(() => {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
    }, [theme]);
    
    // Auto-save effect
    useEffect(() => {
        if (!activeSceneId || isWriting) return;
        const handler = setTimeout(() => {
            if (currentProject) {
                const scene = currentProject.scenes.find(s => s.id === activeSceneId);
                // Only save if the content has actually changed
                if (scene && scene.content !== editorContent) {
                    updateSceneContent(activeSceneId, editorContent);
                }
            }
        }, 1500);
        return () => clearTimeout(handler);
    }, [editorContent, activeSceneId, isWriting, currentProject, updateSceneContent]);
    
    // Session Timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isWriting) {
          interval = setInterval(() => {
            setSessionTime(Date.now() - (sessionStartTime || Date.now()));
          }, 1000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isWriting, sessionStartTime]);

    // --- Handlers ---
    const handleStartSession = () => {
        setInitialWordCount(currentProject?.totalWords || 0);
        setSessionStartTime(Date.now());
        setIsWriting(true);
    };

    const handleEndSession = async () => {
        if (!activeSceneId || !currentProject) return;
        setIsWriting(false);
        const duration = sessionTime;
        // Ensure the final content is saved and get the accurate word count
        const finalWordCount = await updateSceneContent(activeSceneId, editorContent);
        const wordsWritten = finalWordCount - initialWordCount;

        await addSession({ duration, wordsWritten, sceneId: activeSceneId, content: editorContent });
        setSessionTime(0);
    };

    const handleRevert = async (session: Session) => {
        if (!window.confirm("Are you sure? This will overwrite the current content of the scene.")) return;
        const { sceneId, content } = session.snapshot;
        // First, tell the store to update the editor content
        setEditorContent(content);
        // Then, tell the store to save this reverted content to the database
        await updateSceneContent(sceneId, content);
        // Finally, make sure the reverted scene is the active one
        setActiveSceneId(sceneId);
        alert("Scene reverted successfully.");
    };

    const onDragEnd = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination || !currentProject) return;
        const reorderedScenes = Array.from(currentProject.scenes);
        const [moved] = reorderedScenes.splice(source.index, 1);
        reorderedScenes.splice(destination.index, 0, moved);
        reorderScenes(reorderedScenes); // This action is now in the store
    };

    const handleRename = () => {
        if(editingSceneId && editingSceneTitle) {
            renameScene(editingSceneId, editingSceneTitle); // This action is in the store
        }
        setEditingSceneId(null);
    }

    const handleConfirmDelete = () => {
        if (showDeleteSceneModal) {
            deleteScene(showDeleteSceneModal.id);
            setShowDeleteSceneModal(null);
        }
    };

    if (!currentProject) return null;

    // --- Calculations for UI ---
    const activeScene = currentProject.scenes.find(s => s.id === activeSceneId);
    const activeSceneSessions = currentProject.sessions.filter(s => s.snapshot?.sceneId === activeSceneId).sort((a,b) => b.startTime.toMillis() - a.startTime.toMillis());
    const timeOnActiveScene = activeSceneSessions.reduce((sum, s) => sum + s.duration, 0);

    return (
        <div className="h-screen w-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors">
            <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-2 flex-shrink-0 flex items-center z-10">
                <button onClick={() => setCurrentProject(null)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0">
                    <ChevronLeft className="w-5 h-5"/> Back
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate text-center mx-4 flex-1 min-w-0">{currentProject.name}</h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-sm text-gray-500 dark:text-gray-400 hidden md:flex items-center gap-4 border-r dark:border-gray-600 pr-4 mr-2">
                        <span>{currentProject.totalWords.toLocaleString()} words</span>
                        <span className="flex items-center gap-1.5"><Clock size={14}/> {formatTime(sessionTime)}</span>
                    </div>
                    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        {theme === 'light' ? <Moon size={20} className="text-gray-600"/> : <Sun size={20} className="text-yellow-400"/>}
                    </button>
                    <button onClick={() => setShowStats(s => !s)} className={`p-2 rounded transition-colors ${showStats ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                        <BarChart3 size={20}/>
                    </button>
                    <button onClick={isWriting ? handleEndSession : handleStartSession} className={`px-4 py-2 rounded flex items-center gap-2 w-36 justify-center ${isWriting ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                      {isWriting ? <Pause size={16}/> : <Play size={16}/>}
                      {isWriting ? 'End Session' : 'Start Session'}
                    </button>
                </div>
            </header>
          
            <div className="flex-grow flex overflow-hidden relative">
                <aside className="w-64 h-full bg-gray-50 dark:bg-gray-900/50 border-r dark:border-gray-700 flex flex-col overflow-y-auto">
                    <div className="p-2 border-b dark:border-gray-700">
                        <button 
                          onClick={() => {
                            const title = window.prompt("Enter new scene title:", `Scene ${currentProject.scenes.length + 1}`);
                            if (title) createNewScene(title);
                          }} 
                          className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                            <PlusCircle className="w-5 h-5"/> New Scene
                        </button>
                    </div>
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="scenes">
                            {(provided) => (
                                <ul className="flex-grow p-2 space-y-1" {...provided.droppableProps} ref={provided.innerRef}>
                                    {currentProject.scenes?.map((scene, index) => (
                                        <Draggable key={scene.id} draggableId={scene.id} index={index}>
                                            {(provided, snapshot) => (
                                                <li ref={provided.innerRef} {...provided.draggableProps} className={`group relative rounded-md ${snapshot.isDragging ? 'shadow-lg bg-white dark:bg-gray-700' : ''}`}>
                                                    {editingSceneId === scene.id ? (
                                                        <input type="text" value={editingSceneTitle} onChange={(e) => setEditingSceneTitle(e.target.value)} onBlur={handleRename} onKeyDown={(e) => {if(e.key === 'Enter') handleRename();}} className="w-full p-2 rounded border border-blue-500 bg-white dark:bg-gray-800 dark:text-white" autoFocus/>
                                                    ) : (
                                                        <div onClick={() => setActiveSceneId(scene.id)} className={`w-full text-left p-2 rounded-md transition-colors flex justify-between items-center cursor-pointer ${activeSceneId === scene.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} onDoubleClick={() => {setEditingSceneId(scene.id); setEditingSceneTitle(scene.title);}}>
                                                            <div className="flex items-center gap-2 flex-grow min-w-0">
                                                                <div {...provided.dragHandleProps} className="p-1 cursor-grab"><Menu size={16} /></div>
                                                                <div className="flex-grow min-w-0">
                                                                    <span className="font-medium truncate block">{scene.title}</span>
                                                                    <span className={`text-xs block ${activeSceneId === scene.id ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>{scene.wordCount} words</span>
                                                                </div>
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); setShowDeleteSceneModal(scene); }} className="p-1 rounded-full text-gray-500 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </li>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </ul>
                            )}
                        </Droppable>
                    </DragDropContext>
                </aside>

                <main className={`flex-grow h-full flex flex-col transition-all duration-300 ${showStats ? 'mr-80' : ''}`}>
                     <TiptapEditor
                        key={activeSceneId || 'no-scene'} 
                        content={editorContent}
                        onChange={setEditorContent}
                        disabled={!activeSceneId}
                    />
                </main>

                {showDeleteSceneModal && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm"><h2 className="text-lg font-bold text-gray-900 dark:text-white">Delete Scene?</h2><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Are you sure you want to delete "{showDeleteSceneModal.title}"? This cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowDeleteSceneModal(null)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                <button onClick={handleConfirmDelete} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                </div></div></div>)}

                <aside className={`fixed top-14 right-0 h-[calc(100%-3.5rem)] w-80 bg-white dark:bg-gray-800 border-l dark:border-gray-700 shadow-lg overflow-y-auto transform transition-transform duration-300 ease-in-out z-20 ${showStats ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Statistics</h2>
                        <div className="space-y-6">
                          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4"><h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Overall Project</h3><div className="space-y-2 text-sm text-gray-600 dark:text-gray-300"><div className="flex justify-between"><span>Total Words:</span><span className="font-medium text-gray-800 dark:text-gray-100">{currentProject.totalWords.toLocaleString()}</span></div><div className="flex justify-between"><span>Total Scenes:</span><span className="font-medium text-gray-800 dark:text-gray-100">{currentProject.scenes.length}</span></div><div className="flex justify-between"><span>Total Time:</span><span className="font-medium text-gray-800 dark:text-gray-100">{formatTime(currentProject.totalTime)}</span></div><div className="flex justify-between"><span>Total Sessions:</span><span className="font-medium text-gray-800 dark:text-gray-100">{currentProject.sessions.length}</span></div></div></div>
                          {activeScene && (<div className="bg-blue-100 dark:bg-blue-900/50 rounded-lg p-4 ring-1 ring-blue-200 dark:ring-blue-800"><h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2 truncate">Active Scene: {activeScene.title}</h3><div className="space-y-2 text-sm text-blue-800 dark:text-blue-300"><div className="flex justify-between"><span>Word Count:</span><span className="font-medium text-blue-900 dark:text-blue-200">{activeScene.wordCount.toLocaleString()}</span></div><div className="flex justify-between"><span>Time Spent Here:</span><span className="font-medium text-blue-900 dark:text-blue-200">{formatTime(timeOnActiveScene)}</span></div><div className="flex justify-between"><span>Sessions Here:</span><span className="font-medium text-blue-900 dark:text-blue-200">{activeSceneSessions.length}</span></div></div></div>)}
                          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4"><h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Snapshots for this Scene</h3>{activeSceneSessions.length > 0 ? (<div className="space-y-3 max-h-60 overflow-y-auto">{activeSceneSessions.map(session => (<div key={session.id} className="text-sm border-b border-gray-200 dark:border-gray-600 pb-2 last:border-b-0"><div className="flex justify-between items-center"><div><span className="font-medium text-gray-700 dark:text-gray-200">{new Date(session.startTime.toDate()).toLocaleString()}</span><div className="text-gray-600 dark:text-gray-400 text-xs mt-1">{formatTime(session.duration)} | {session.wordsWritten} words</div></div><button onClick={() => handleRevert(session)} title="Revert to this version" className="p-1.5 bg-gray-200 dark:bg-gray-600 rounded hover:bg-indigo-200 dark:hover:bg-indigo-500 transition-colors"><History size={14} className="text-gray-600 dark:text-gray-300"/></button></div></div>))}</div>) : (<div className="text-center text-sm text-gray-500 py-4"><p>No writing history for this scene yet.</p></div>)}</div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default EditorView;
