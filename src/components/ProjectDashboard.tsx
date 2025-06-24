import React, { useState } from 'react';
import { BookOpen, FileText, Trash2 } from 'lucide-react';
import { useProjectStore, Project } from '../store/useProjectStore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';

interface ProjectDashboardProps {
  user: User;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ user }) => {
  const { 
    projects, 
    createProject, 
    deleteProject, 
    setCurrentProject 
  } = useProjectStore();

  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const signInWithGoogle = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const signOutUser = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-4 sm:p-6 transition-colors">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          <div className="text-center mb-8">
            <BookOpen className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Novel Writing Studio</h1>
            
            {user && !user.isAnonymous ? (
                <div className='mt-4'>
                    <p className="text-gray-600 dark:text-gray-300">Welcome back, <span className="font-semibold">{user.displayName || 'Writer'}</span>!</p>
                    <button onClick={signOutUser} className="text-sm text-blue-500 hover:underline mt-1">Sign out</button>
                </div>
            ) : (
                <div className='mt-4'>
                    <p className="text-gray-600 dark:text-gray-400">Your personal space to create and manage your stories.</p>
                    <button 
                        onClick={signInWithGoogle} 
                        className="mt-4 bg-white dark:bg-gray-700 dark:text-white text-gray-700 font-semibold px-4 py-2 rounded-lg border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 mx-auto shadow-sm"
                    >
                        <img src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_24dp.png" alt="Google logo" className="w-5 h-5"/>
                        Sign in with Google to Sync Devices
                    </button>
                </div>
            )}
          </div>

          <div className="flex justify-center mb-8">
            <button 
              onClick={() => {
                const name = window.prompt("Enter new project name:");
                if (name) createProject(name);
              }} 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm">
              <FileText className="w-5 h-5" /> New Project
            </button>
          </div>

          <div className="space-y-4">
            {projects.map(project => (
              <div key={project.id} className="border dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 flex justify-between items-center">
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">{project.name}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentProject(project)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Open</button>
                  <button onClick={() => handleDeleteClick(project)} className="bg-red-600 text-white p-2 rounded hover:bg-red-700">
                      <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {projectToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Delete Project?</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Are you sure you want to delete "{projectToDelete.name}"? This action cannot be undone.</p>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={() => setProjectToDelete(null)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                    <button onClick={confirmDelete} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
