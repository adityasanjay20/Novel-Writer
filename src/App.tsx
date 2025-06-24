import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User, signInAnonymously } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { useProjectStore } from './store/useProjectStore';
import ProjectDashboard from './components/ProjectDashboard';
import EditorView from './components/EditorView';

// --- TypeScript Declaration & Config ---
declare var process: { env: { [key: string]: string } };
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};
const appId = process.env.REACT_APP_FIREBASE_APP_ID || 'default-app-id';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const initializeStore = useProjectStore(state => state.initialize);
  const currentProject = useProjectStore(state => state.currentProject);
  const isLoading = useProjectStore(state => state.isLoading);

  useEffect(() => {
    try {
      if (!firebaseConfig.apiKey) {
        console.error("Firebase config is missing!");
        setIsAuthReady(true);
        return;
      }
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);

      const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          const unsubscribeStore = initializeStore(firebaseUser, appId);
          // When the user logs out, we want to stop listening to the old data
          // but onAuthStateChanged will provide a new user, re-triggering this.
        } else {
            // This case should ideally not be hit if anonymous sign-in always works
            await signInAnonymously(auth);
        }
        setIsAuthReady(true);
      });
      return () => unsubscribeAuth();
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      setIsAuthReady(true);
    }
  }, [initializeStore]);

  if (!isAuthReady || isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-white">Loading...</div>;
  }
  if (!user) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-white">Authenticating...</div>;
  }

  return (
    // The theme class is managed inside EditorView now, but we can set a default background here
    <div className="dark"> 
        {currentProject ? <EditorView /> : <ProjectDashboard user={user}/>}
    </div>
  );
}
