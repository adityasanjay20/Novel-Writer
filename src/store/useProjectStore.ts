import { create } from 'zustand';
import { 
    getFirestore, 
    doc, 
    updateDoc, 
    serverTimestamp,
    Timestamp,
    collection,
    query,
    onSnapshot,
    addDoc,
    deleteDoc
} from "firebase/firestore";
import { User } from 'firebase/auth';

// ==========================================
// TYPES & INTERFACES
// ==========================================
export interface Scene {
    id: string;
    title: string;
    content: string;
    wordCount: number;
    createdAt: Timestamp;
}

export interface SceneSnapshot {
    sceneId: string;
    content: string;
}

export interface Session {
    id: string;
    startTime: Timestamp;
    duration: number; 
    wordsWritten: number;
    snapshot: SceneSnapshot;
}

export interface Project {
    id: string;
    name: string;
    scenes: Scene[]; 
    sessions: Session[];
    totalTime: number; 
    totalWords: number;
    createdAt: Timestamp;
    lastModified?: Timestamp;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const countWords = (htmlContent: string): number => {
    if (!htmlContent) return 0;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || "";
    if (text.trim().length === 0) return 0;
    return text.trim().split(/\s+/).length;
};

const debounce = <T extends (...args: any[]) => void>(
    func: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// ==========================================
// STORE INTERFACE
// ==========================================
interface ProjectState {
    // State
    projects: Project[];
    currentProject: Project | null;
    activeSceneId: string | null;
    editorContent: string;
    isLoading: boolean;
    user: User | null;
    appId: string;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    
    // System Actions
    initialize: (user: User, appId: string) => () => void;
    setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
    
    // Project Actions
    createProject: (name: string) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    setCurrentProject: (project: Project | null) => void;
    
    // Scene Actions
    createNewScene: (title: string) => Promise<void>;
    updateSceneContent: (sceneId: string, content: string) => Promise<number>;
    updateSceneContentDebounced: (sceneId: string, content: string) => void;
    reorderScenes: (scenes: Scene[]) => Promise<void>;
    renameScene: (sceneId: string, newTitle: string) => Promise<void>;
    deleteScene: (sceneId: string) => Promise<void>;
    setActiveSceneId: (sceneId: string | null) => void;
    
    // Editor Actions
    setEditorContent: (content: string) => void;
    
    // Session Actions
    addSession: (sessionData: { duration: number, wordsWritten: number, sceneId: string, content: string }) => Promise<void>;
}

// ==========================================
// STORE IMPLEMENTATION
// ==========================================
export const useProjectStore = create<ProjectState>((set, get) => {
    // Create debounced version of updateSceneContent
    const debouncedUpdateSceneContent = debounce(async (sceneId: string, content: string) => {
        try {
            get().setSaveStatus('saving');
            await get().updateSceneContent(sceneId, content);
            get().setSaveStatus('saved');
            setTimeout(() => {
                if (get().saveStatus === 'saved') {
                    get().setSaveStatus('idle');
                }
            }, 2000);
        } catch (error) {
            console.error('Auto-save failed:', error);
            get().setSaveStatus('error');
        }
    }, 1000);

    return {
        // ==========================================
        // INITIAL STATE
        // ==========================================
        projects: [],
        currentProject: null,
        activeSceneId: null,
        editorContent: '',
        isLoading: true,
        user: null,
        appId: 'default-app-id',
        saveStatus: 'idle',

        // ==========================================
        // SYSTEM ACTIONS
        // ==========================================
        initialize: (user, appId) => {
            set({ user, appId, isLoading: true });
            const db = getFirestore();
            const projectsCollectionPath = `/artifacts/${appId}/users/${user.uid}/projects`;
            const q = query(collection(db, projectsCollectionPath));
            
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const projectsData: Project[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (!data.scenes) data.scenes = [];
                    if (!data.sessions) data.sessions = [];
                    projectsData.push({ id: doc.id, ...data } as Project);
                });
                
                const sortedProjects = projectsData.sort((a, b) => 
                    (b.lastModified?.toMillis() || b.createdAt?.toMillis() || 0) - 
                    (a.lastModified?.toMillis() || a.createdAt?.toMillis() || 0)
                );
                
                set({ projects: sortedProjects, isLoading: false });
            }, (error) => {
                console.error("Error fetching projects:", error);
                set({ isLoading: false, saveStatus: 'error' });
            });

            return unsubscribe;
        },

        setSaveStatus: (status) => set({ saveStatus: status }),

        // ==========================================
        // PROJECT ACTIONS
        // ==========================================
        createProject: async (name) => {
            const { user, appId } = get();
            if (!user) throw new Error('User not authenticated');
            
            try {
                set({ saveStatus: 'saving' });
                const db = getFirestore();
                
                const firstScene: Scene = { 
                    id: `scene_${Date.now()}`, 
                    title: 'Chapter 1', 
                    content: '', 
                    wordCount: 0, 
                    createdAt: Timestamp.now() 
                };
                
                const newProjectData = { 
                    name, 
                    scenes: [firstScene], 
                    sessions: [], 
                    totalTime: 0, 
                    totalWords: 0, 
                    createdAt: serverTimestamp(), 
                    lastModified: serverTimestamp() 
                };
                
                await addDoc(collection(db, `/artifacts/${appId}/users/${user.uid}/projects`), newProjectData);
                set({ saveStatus: 'saved' });
            } catch (error) {
                console.error('Error creating project:', error);
                set({ saveStatus: 'error' });
                throw error;
            }
        },

        deleteProject: async (projectId) => {
            const { user, appId, currentProject, setCurrentProject } = get();
            if (!user) throw new Error('User not authenticated');
            
            try {
                set({ saveStatus: 'saving' });
                
                if (currentProject?.id === projectId) {
                    setCurrentProject(null);
                }
                
                const db = getFirestore();
                const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${projectId}`);
                await deleteDoc(projectDocRef);
                
                set({ saveStatus: 'saved' });
            } catch (error) {
                console.error('Error deleting project:', error);
                set({ saveStatus: 'error' });
                throw error;
            }
        },

        setCurrentProject: (project) => {
            set({ currentProject: project });
            if (project && project.scenes.length > 0) {
                get().setActiveSceneId(project.scenes[0].id);
            } else {
                get().setActiveSceneId(null);
            }
        },

        // ==========================================
        // SCENE ACTIONS
        // ==========================================
        createNewScene: async (title) => {
            const { currentProject, user, appId, setActiveSceneId } = get();
            if (!currentProject || !user) throw new Error('No current project or user');

            const newScene: Scene = { 
                id: `scene_${Date.now()}`, 
                title, 
                content: '', 
                wordCount: 0, 
                createdAt: Timestamp.now() 
            };
            
            const updatedScenes = [...currentProject.scenes, newScene];
            const originalScenes = currentProject.scenes;

            // Optimistic update
            set(state => ({ 
                currentProject: state.currentProject ? { 
                    ...state.currentProject, 
                    scenes: updatedScenes,
                    lastModified: Timestamp.now()
                } : null,
                saveStatus: 'saving'
            }));
            
            setActiveSceneId(newScene.id);

            try {
                const db = getFirestore();
                const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${currentProject.id}`);
                await updateDoc(projectDocRef, { 
                    scenes: updatedScenes,
                    lastModified: serverTimestamp()
                });
                set({ saveStatus: 'saved' });
            } catch (error) {
                console.error("Error creating new scene:", error);
                set(state => ({ 
                    currentProject: state.currentProject ? { 
                        ...state.currentProject, 
                        scenes: originalScenes 
                    } : null,
                    saveStatus: 'error'
                }));
                throw error;
            }
        },

        updateSceneContent: async (sceneId, content) => {
            const { currentProject, user, appId } = get();
            if (!currentProject || !user) return currentProject?.totalWords || 0;
            
            const sceneIndex = currentProject.scenes.findIndex(s => s.id === sceneId);
            if (sceneIndex === -1) return currentProject.totalWords;

            const updatedScene = { 
                ...currentProject.scenes[sceneIndex], 
                content, 
                wordCount: countWords(content) 
            };
            const updatedScenes = [...currentProject.scenes];
            updatedScenes[sceneIndex] = updatedScene;
            
            const totalWords = updatedScenes.reduce((sum, scene) => sum + scene.wordCount, 0);
            
            // Optimistic update
            set(state => ({
                currentProject: state.currentProject ? {
                    ...state.currentProject,
                    scenes: updatedScenes,
                    totalWords,
                    lastModified: Timestamp.now()
                } : null
            }));
            
            const db = getFirestore();
            const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${currentProject.id}`);
            await updateDoc(projectDocRef, { 
                scenes: updatedScenes, 
                totalWords, 
                lastModified: serverTimestamp() 
            });

            return totalWords;
        },

        updateSceneContentDebounced: (sceneId, content) => {
            set({ editorContent: content });
            debouncedUpdateSceneContent(sceneId, content);
        },
        
        reorderScenes: async (scenes) => {
            const { currentProject, user, appId } = get();
            if (!currentProject || !user) throw new Error('No current project or user');
            
            set(state => ({
                currentProject: state.currentProject ? {
                    ...state.currentProject,
                    scenes,
                    lastModified: Timestamp.now()
                } : null,
                saveStatus: 'saving'
            }));
            
            try {
                const db = getFirestore();
                const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${currentProject.id}`);
                await updateDoc(projectDocRef, { 
                    scenes,
                    lastModified: serverTimestamp()
                });
                set({ saveStatus: 'saved' });
            } catch (error) {
                console.error("Error saving reordered scenes:", error);
                set({ saveStatus: 'error' });
                throw error;
            }
        },

        renameScene: async (sceneId, newTitle) => {
            const { currentProject, user, appId } = get();
            if (!currentProject || !user) throw new Error('No current project or user');
            
            const updatedScenes = currentProject.scenes.map(s => 
                s.id === sceneId ? { ...s, title: newTitle } : s
            );
            
            set(state => ({
                currentProject: state.currentProject ? {
                    ...state.currentProject,
                    scenes: updatedScenes,
                    lastModified: Timestamp.now()
                } : null,
                saveStatus: 'saving'
            }));
            
            try {
                const db = getFirestore();
                const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${currentProject.id}`);
                await updateDoc(projectDocRef, { 
                    scenes: updatedScenes,
                    lastModified: serverTimestamp()
                });
                set({ saveStatus: 'saved' });
            } catch (error) {
                console.error("Error renaming scene:", error);
                set({ saveStatus: 'error' });
                throw error;
            }
        },

        deleteScene: async (sceneId) => {
            const { currentProject, user, appId, activeSceneId, setActiveSceneId } = get();
            if (!currentProject || !user) throw new Error('No current project or user');
            
            if (currentProject.scenes.length <= 1) {
                throw new Error('Cannot delete the last scene');
            }
            
            const updatedScenes = currentProject.scenes.filter(s => s.id !== sceneId);
            const totalWords = updatedScenes.reduce((sum, scene) => sum + scene.wordCount, 0);
            
            let newActiveSceneId = activeSceneId;
            if (activeSceneId === sceneId) {
                newActiveSceneId = updatedScenes[0]?.id || null;
                setActiveSceneId(newActiveSceneId);
            }
            
            set(state => ({
                currentProject: state.currentProject ? {
                    ...state.currentProject,
                    scenes: updatedScenes,
                    totalWords,
                    lastModified: Timestamp.now()
                } : null,
                saveStatus: 'saving'
            }));
            
            try {
                const db = getFirestore();
                const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${currentProject.id}`);
                await updateDoc(projectDocRef, { 
                    scenes: updatedScenes, 
                    totalWords,
                    lastModified: serverTimestamp()
                });
                set({ saveStatus: 'saved' });
            } catch (error) {
                console.error("Error deleting scene:", error);
                set({ saveStatus: 'error' });
                throw error;
            }
        },

        setActiveSceneId: (sceneId) => {
            const project = get().currentProject;
            if (project && sceneId) {
                const scene = project.scenes.find(s => s.id === sceneId);
                set({ 
                    activeSceneId: sceneId, 
                    editorContent: scene?.content || '' 
                });
            } else {
                set({ 
                    activeSceneId: null, 
                    editorContent: '' 
                });
            }
        },

        // ==========================================
        // EDITOR ACTIONS
        // ==========================================
        setEditorContent: (content) => set({ editorContent: content }),

        // ==========================================
        // SESSION ACTIONS
        // ==========================================
        addSession: async (sessionData) => {
            const { currentProject, user, appId } = get();
            if (!currentProject || !user) throw new Error('No current project or user');
            
            try {
                set({ saveStatus: 'saving' });
                
                const snapshot: SceneSnapshot = {
                    sceneId: sessionData.sceneId,
                    content: sessionData.content,
                };

                const newSession: Session = {
                    id: `session_${Date.now()}`,
                    startTime: Timestamp.now(),
                    duration: sessionData.duration,
                    wordsWritten: sessionData.wordsWritten,
                    snapshot: snapshot
                };

                const updatedSessions = [...currentProject.sessions, newSession];
                const updatedTime = currentProject.totalTime + sessionData.duration;

                set(state => ({
                    currentProject: state.currentProject ? {
                        ...state.currentProject,
                        sessions: updatedSessions,
                        totalTime: updatedTime,
                        lastModified: Timestamp.now()
                    } : null
                }));

                const db = getFirestore();
                const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${currentProject.id}`);
                await updateDoc(projectDocRef, { 
                    sessions: updatedSessions, 
                    totalTime: updatedTime,
                    lastModified: serverTimestamp()
                });
                
                set({ saveStatus: 'saved' });
            } catch (error) {
                console.error("Error adding session:", error);
                set({ saveStatus: 'error' });
                throw error;
            }
        }
    };
});