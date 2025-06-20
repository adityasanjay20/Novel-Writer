import React, { useState, useEffect, useRef } from 'react';
import { Clock, FileText, Edit3, Save, Play, Pause, BarChart3, BookOpen, Trash2, ChevronLeft, LogIn, PlusCircle, History } from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, User, signInWithCustomToken, Auth } from "firebase/auth";
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    setDoc, 
    deleteDoc, 
    onSnapshot, 
    query,
    serverTimestamp,
    Timestamp,
    Firestore,
    QuerySnapshot,
    DocumentData,
    FieldValue,
    updateDoc
} from "firebase/firestore";

// --- TypeScript Declaration for Environment Variables ---
declare var __firebase_config: string;
declare var __app_id: string;
declare var __initial_auth_token: string;


// --- Firebase Configuration ---
const firebaseConfig = {



  apiKey: "AIzaSyCeEOeSlzANs38duWDiHla_QJjbcr_Hjzc",



  authDomain: "novel-writer-app-5c40d.firebaseapp.com",



  projectId: "novel-writer-app-5c40d",



  storageBucket: "novel-writer-app-5c40d.firebasestorage.app",



  messagingSenderId: "651109127150",



  appId: "1:651109127150:web:829c4897615ded87e1f4ff",



  measurementId: "G-9H40MQR6BM"



};
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.appId;


// --- Data Structures ---
interface Scene {
    id: string;
    title: string;
    content: string;
    wordCount: number;
    createdAt: Timestamp;
}

// NEW: A snapshot of a scene's content at a point in time
interface SceneSnapshot {
    sceneId: string;
    content: string;
}

interface Session {
  id: string;
  startTime: Timestamp;
  duration: number; // in milliseconds
  wordsWritten: number;
  snapshot: SceneSnapshot; // Each session now saves a snapshot
}

interface Project {
  id:string;
  name: string;
  scenes: Scene[]; 
  sessions: Session[];
  totalTime: number; 
  totalWords: number;
  createdAt: Timestamp;
  lastModified?: Timestamp;
}

// --- Utility Function ---
const countWords = (text: string): number => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

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

// --- Main App Component ---
export default function NovelWritingApp() {
  // Firebase State
  const [auth, setAuth] = useState<Auth | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // App State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Session and Editor State
  const [isWriting, setIsWriting] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [editorContent, setEditorContent] = useState('');
  const [initialProjectWordCount, setInitialProjectWordCount] = useState(0);
  
  // UI State
  const [showStats, setShowStats] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<Project | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Firebase Initialization and Auth Effect ---
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      setAuth(authInstance);
      setDb(dbInstance);

      const unsubscribe = onAuthStateChanged(authInstance, async (user: User | null) => {
        if (user) {
          setUser(user);
        } else {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(authInstance, __initial_auth_token);
                } else {
                    await signInAnonymously(authInstance);
                }
            } catch (error) { console.error("Error during sign-in:", error); }
        }
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      setIsAuthReady(true);
    }
  }, []);

  // --- Firestore Data Fetching Effect ---
  useEffect(() => {
    if (isAuthReady && user && db) {
      setIsLoading(true);
      const projectsCollectionPath = `/artifacts/${appId}/users/${user.uid}/projects`;
      const q = query(collection(db, projectsCollectionPath));
      
      const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
        const projectsData: Project[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (!data.scenes) data.scenes = [];
          projectsData.push({ id: doc.id, ...data } as Project);
        });
        setProjects(projectsData.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        setIsLoading(false);
      }, (error: Error) => {
        console.error("Error fetching projects:", error);
        setIsLoading(false);
      });

      return () => unsubscribe();
    } else if (isAuthReady) {
        setIsLoading(false);
    }
  }, [isAuthReady, user, db]);

  // --- Scene and Session Effects ---
  useEffect(() => {
    if (activeSceneId && currentProject) {
        const activeScene = currentProject.scenes.find(scene => scene.id === activeSceneId);
        setEditorContent(activeScene?.content || '');
    } else {
        setEditorContent('');
    }
  }, [activeSceneId, currentProject]);

  useEffect(() => {
    if (!currentProject || !activeSceneId || isWriting) return;
    const handler = setTimeout(() => { saveSceneContent(); }, 1500);
    return () => { clearTimeout(handler); };
  }, [editorContent, activeSceneId, isWriting]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isWriting && sessionStartTime) {
      interval = setInterval(() => {
        setSessionTime(Date.now() - sessionStartTime);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isWriting, sessionStartTime]);


  // --- Project and Scene Functions ---
  const saveSceneContent = async (content = editorContent): Promise<number> => {
    if (!currentProject || !activeSceneId || !db || !user) return currentProject?.totalWords || 0;
    const sceneIndex = currentProject.scenes.findIndex(s => s.id === activeSceneId);
    if (sceneIndex === -1) return currentProject.totalWords;

    const updatedScene = { ...currentProject.scenes[sceneIndex], content: content, wordCount: countWords(content) };
    const updatedScenes = [...currentProject.scenes];
    updatedScenes[sceneIndex] = updatedScene;

    const totalWords = updatedScenes.reduce((sum, scene) => sum + scene.wordCount, 0);
    const updatedProjectData = { scenes: updatedScenes, totalWords: totalWords, lastModified: serverTimestamp() };

    try {
        const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${currentProject.id}`);
        await updateDoc(projectDocRef, updatedProjectData);
        setCurrentProject(prev => prev ? { ...prev, scenes: updatedScenes, totalWords } : null);
        return totalWords;
    } catch (e) { 
        console.error("Error saving scene:", e);
        return currentProject.totalWords;
    }
  };
  
  const createNewScene = async () => {
    if (!currentProject || !db || !user) return;
    const title = window.prompt("Enter new scene title:", `Scene ${currentProject.scenes.length + 1}`);
    if (!title) return;

    const newScene: Scene = { id: `scene_${Date.now()}`, title, content: '', wordCount: 0, createdAt: Timestamp.now() };
    const updatedScenes = [...currentProject.scenes, newScene];
    try {
        const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${currentProject.id}`);
        await updateDoc(projectDocRef, { scenes: updatedScenes });
        setCurrentProject(prev => prev ? { ...prev, scenes: updatedScenes } : null);
        setActiveSceneId(newScene.id);
    } catch(e) { console.error("Error creating new scene:", e); }
  };

  const createProject = async () => {
    if (!db || !user) return;
    const name = window.prompt('Enter project name:');
    if (name) {
      try {
        const firstScene: Scene = { id: `scene_${Date.now()}`, title: 'Chapter 1', content: '', wordCount: 0, createdAt: Timestamp.now() };
        const newProjectData = { name, scenes: [firstScene], sessions: [], totalTime: 0, totalWords: 0, createdAt: serverTimestamp(), lastModified: serverTimestamp() };
        const docRef = await addDoc(collection(db, `/artifacts/${appId}/users/${user.uid}/projects`), newProjectData);
        
        const locallyCreatedProject: Project = { id: docRef.id, ...newProjectData, createdAt: Timestamp.now(), lastModified: Timestamp.now() };
        setCurrentProject(locallyCreatedProject);
        setActiveSceneId(firstScene.id);
      } catch (error) { console.error("Error creating project:", error); }
    }
  };
  
  const deleteProject = async (projectId: string) => {
    if (!db || !user) return;
    
    if (currentProject?.id === projectId) {
        setCurrentProject(null);
    }

    try {
        const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${projectId}`);
        await deleteDoc(projectDocRef);
    } catch(e) {
        console.error("Error deleting project:", e);
        alert("Failed to delete project.");
    } finally {
        setShowDeleteModal(null);
    }
  };

  const openProject = (project: Project) => {
    setCurrentProject(project);
    if(project.scenes && project.scenes.length > 0) {
        setActiveSceneId(project.scenes[0].id);
    } else { setActiveSceneId(null); }
  };
    
  // --- Session and Versioning Functions ---
  const startSession = () => {
    if(!currentProject) return;
    setSessionStartTime(Date.now());
    setSessionTime(0);
    setInitialProjectWordCount(currentProject.totalWords);
    setIsWriting(true);
  };

  const endSession = async () => {
    if (!isWriting || !currentProject || !sessionStartTime || !db || !user || !activeSceneId) return;
    
    const newTotalWords = await saveSceneContent();
    const sessionDuration = sessionTime;
    const wordsWrittenInSession = Math.max(0, newTotalWords - initialProjectWordCount);
    
    const snapshot: SceneSnapshot = { sceneId: activeSceneId, content: editorContent };
    
    const newSession: Session = { 
        id: `session_${Date.now()}`, 
        startTime: Timestamp.fromMillis(sessionStartTime), 
        duration: sessionDuration, 
        wordsWritten: wordsWrittenInSession, 
        snapshot: snapshot
    };
    
    const updatedProjectData = { 
        sessions: [...currentProject.sessions, newSession], 
        totalTime: currentProject.totalTime + sessionDuration 
    };

    try {
        const projectDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/projects/${currentProject.id}`);
        await updateDoc(projectDocRef, updatedProjectData);
        setCurrentProject(prev => prev ? { ...prev, ...updatedProjectData } : null);
    } catch(error) { console.error("Error ending session:", error);
    } finally {
        setIsWriting(false);
        setSessionStartTime(null);
        setSessionTime(0);
    }
  };

  const revertToSnapshot = async (session: Session) => {
    if (!currentProject || !window.confirm("Are you sure you want to revert this scene to a previous version? Your current text in this scene will be overwritten.")) {
        return;
    }

    const { sceneId, content } = session.snapshot;
    
    const sceneIndex = currentProject.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) {
        alert("The original scene for this snapshot no longer exists.");
        return;
    }

    setEditorContent(content);
    await saveSceneContent(content);
    alert("Scene reverted successfully.");
  };

  // --- Render Logic ---
  if (isLoading || !isAuthReady) return <div className="flex items-center justify-center min-h-screen bg-gray-50">Loading...</div>;
  if (!user) return <div className="flex items-center justify-center min-h-screen bg-gray-50">Authenticating...</div>;
  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-6 sm:p-8">
            <div className="text-center mb-8">
              <BookOpen className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Novel Writing Studio</h1>
              <p className="text-gray-600">Your personal space to create and manage your stories.</p>
            </div>
            <div className="flex justify-center mb-8">
              <button onClick={createProject} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 shadow-sm">
                <FileText className="w-5 h-5" /> New Project
              </button>
            </div>
            <div className="space-y-4">
              {projects.map(project => (
                <div key={project.id} className="border rounded-lg p-4 flex justify-between items-center">
                  <h3 className="font-semibold text-lg">{project.name}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openProject(project)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Open</button>
                    <button onClick={() => setShowDeleteModal(project)} className="bg-red-600 text-white p-2 rounded hover:bg-red-700">
                        <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {showDeleteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                    <h2 className="text-lg font-bold text-gray-900">Delete Project?</h2>
                    <p className="mt-2 text-sm text-gray-600">Are you sure you want to delete "{showDeleteModal.name}"? This action cannot be undone.</p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={() => setShowDeleteModal(null)} className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
                        <button onClick={() => deleteProject(showDeleteModal.id)} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  }

  // --- Calculations for UI ---
  const activeScene = currentProject.scenes.find(s => s.id === activeSceneId);
  const activeSceneSessions = currentProject.sessions
    .filter(session => session.snapshot?.sceneId === activeSceneId)
    .sort((a,b) => b.startTime.toMillis() - a.startTime.toMillis());
  const timeOnActiveScene = activeSceneSessions.reduce((sum, session) => sum + session.duration, 0);


  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100">
      <header className="bg-white border-b px-4 py-2 flex-shrink-0 flex justify-between items-center z-10">
        <button onClick={() => { if(isWriting) endSession(); setCurrentProject(null); }} className="text-gray-600 hover:text-gray-900 flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5"/> Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900 truncate mx-4">{currentProject.name}</h1>
        <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500 hidden md:flex items-center gap-4 border-r pr-4 mr-2">
                <span>{currentProject.totalWords} words</span>
                <span className="flex items-center gap-1.5"><Clock size={14}/> {formatTime(sessionTime)}</span>
            </div>
            <button onClick={() => setShowStats(s => !s)} className={`p-2 rounded transition-colors ${showStats ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <BarChart3 size={20}/>
            </button>
            <button onClick={isWriting ? endSession : startSession} className={`px-4 py-2 rounded flex items-center gap-2 w-36 justify-center ${isWriting ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
              {isWriting ? <Pause size={16}/> : <Play size={16}/>}
              {isWriting ? 'End Session' : 'Start Session'}
            </button>
        </div>
      </header>
      
      <div className="flex-grow flex overflow-hidden relative">
        <aside className="w-64 h-full bg-gray-50 border-r flex flex-col overflow-y-auto">
            <div className="p-2 border-b">
                <button onClick={createNewScene} className="w-full bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 flex items-center justify-center gap-2">
                    <PlusCircle className="w-5 h-5"/> New Scene
                </button>
            </div>
            <ul className="flex-grow p-2 space-y-1">
                {currentProject.scenes?.map(scene => (
                    <li key={scene.id}>
                        <button onClick={() => setActiveSceneId(scene.id)} className={`w-full text-left p-2 rounded transition-colors ${activeSceneId === scene.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-200'}`}>
                            <span className="font-medium truncate block">{scene.title}</span>
                            <span className={`text-xs block ${activeSceneId === scene.id ? 'text-blue-200' : 'text-gray-500'}`}>{scene.wordCount} words</span>
                        </button>
                    </li>
                ))}
            </ul>
        </aside>

        <main className={`flex-grow h-full flex flex-col transition-all duration-300 ${showStats ? 'mr-80' : ''}`}>
            <textarea
              ref={textareaRef}
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              placeholder="Select a scene to start writing..."
              className="w-full h-full p-8 lg:p-12 resize-none border-none outline-none text-lg leading-relaxed bg-white"
              disabled={!activeSceneId}
            />
        </main>

        <aside className={`fixed top-14 right-0 h-[calc(100%-3.5rem)] w-80 bg-white border-l shadow-lg overflow-y-auto transform transition-transform duration-300 ease-in-out z-20 ${showStats ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
                <div className="space-y-6">
                  
                  {/* Project Stats */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Overall Project</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Total Words:</span><span className="font-medium">{currentProject.totalWords.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Total Scenes:</span><span className="font-medium">{currentProject.scenes.length}</span></div>
                      <div className="flex justify-between"><span>Total Time:</span><span className="font-medium">{formatTime(currentProject.totalTime)}</span></div>
                      <div className="flex justify-between"><span>Total Sessions:</span><span className="font-medium">{currentProject.sessions.length}</span></div>
                    </div>
                  </div>

                  {/* Active Scene Stats */}
                  {activeScene && (
                    <div className="bg-blue-50 rounded-lg p-4 ring-1 ring-blue-200">
                      <h3 className="font-medium text-blue-900 mb-2 truncate">Active Scene: {activeScene.title}</h3>
                      <div className="space-y-2 text-sm text-blue-800">
                        <div className="flex justify-between"><span>Word Count:</span><span className="font-medium">{activeScene.wordCount.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Time Spent Here:</span><span className="font-medium">{formatTime(timeOnActiveScene)}</span></div>
                        <div className="flex justify-between"><span>Sessions Here:</span><span className="font-medium">{activeSceneSessions.length}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Scene Snapshots */}
                  <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-2">Snapshots for this Scene</h3>
                      {activeSceneSessions.length > 0 ? (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {activeSceneSessions.map(session => (
                              <div key={session.id} className="text-sm border-b border-gray-200 pb-2 last:border-b-0">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="font-medium text-gray-700">{new Date(session.startTime.toDate()).toLocaleString()}</span>
                                        <div className="text-gray-600 text-xs mt-1">{formatTime(session.duration)} | {session.wordsWritten} words</div>
                                    </div>
                                    <button onClick={() => revertToSnapshot(session)} title="Revert to this version" className="p-1.5 bg-gray-200 rounded hover:bg-indigo-200 transition-colors">
                                        <History size={14} className="text-gray-600"/>
                                    </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center text-sm text-gray-500 py-4">
                            <p>No writing history for this scene yet. Start a session to create your first snapshot!</p>
                        </div>
                      )}
                  </div>

                </div>
              </div>
        </aside>

      </div>
    </div>
  );
}
