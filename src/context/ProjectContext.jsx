'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProjectState] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);

        // Restore saved project from localStorage or pick first
        const savedId = localStorage.getItem('gtm_active_project');
        const saved = data.find(p => String(p.id) === savedId);
        if (saved) {
          setActiveProjectState(saved);
        } else if (data.length > 0) {
          setActiveProjectState(data[0]);
          localStorage.setItem('gtm_active_project', String(data[0].id));
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const setActiveProject = useCallback((project) => {
    setActiveProjectState(project);
    localStorage.setItem('gtm_active_project', String(project.id));
  }, []);

  const createProject = useCallback(async (data) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create project');
    }
    const newProject = await res.json();
    setProjects(prev => [...prev, newProject]);
    setActiveProject(newProject);
    return newProject;
  }, [setActiveProject]);

  const refreshProjects = fetchProjects;

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      setActiveProject,
      createProject,
      refreshProjects,
      loading,
      projectId: activeProject?.id || null,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
