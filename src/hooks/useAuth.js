import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force refresh trigger
  const navigate = useNavigate();

  const isTokenUsable = (token) => {
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return true;
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  };

  const clearAuthStorage = () => {
    localStorage.removeItem("househelp_user");
    localStorage.removeItem("househelp_access_token");
  };

  useEffect(() => {
    checkAuthState();
  }, [refreshTrigger]); // Re-check when refreshTrigger changes

  const checkAuthState = useCallback(() => {
    try {
      const userData = localStorage.getItem("househelp_user");
      const accessToken = localStorage.getItem("househelp_access_token");

      if (userData && userData !== "null" && userData !== "undefined" && isTokenUsable(accessToken)) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } else {
        clearAuthStorage();
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error checking auth state:", error);
      clearAuthStorage();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (userData) => {
    console.log(' useAuth login called with:', userData);
    const payload = userData?.user ? userData.user : userData;
    const accessToken = userData?.accessToken || payload?.accessToken || payload?.token || "";

    if (accessToken) {
      localStorage.setItem("househelp_access_token", accessToken);
    }

    localStorage.setItem("househelp_user", JSON.stringify(payload));
    setUser(payload);
    setIsAuthenticated(true);
    setRefreshTrigger(prev => prev + 1); // Trigger refresh
    console.log('✅ User logged in successfully, role:', payload?.role);
  };

  const logout = () => {
    console.log("Logout called - clearing localStorage and state");
    clearAuthStorage();
    setUser(null);
    setIsAuthenticated(false);
    setRefreshTrigger(prev => prev + 1); // Trigger refresh for all instances
    
    // Clear all application state and navigate to home
    console.log("🔄 Performing clean logout with automatic refresh");
    
    // Use window.location.href for a clean navigation that resets all state
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  };

  // Check authentication directly from localStorage to avoid state timing issues
  const isCurrentlyAuthenticated = () => {
    try {
      const userData = localStorage.getItem("househelp_user");
      const accessToken = localStorage.getItem("househelp_access_token");
      return Boolean(userData && userData !== "null" && userData !== "undefined" && isTokenUsable(accessToken));
    } catch (error) {
      console.error("Error checking current auth:", error);
      return false;
    }
  };

  const requireAuth = (redirectTo = "/login") => {
    const authStatus = isCurrentlyAuthenticated();
    console.log("RequireAuth check - authenticated:", authStatus);
    
    if (!authStatus) {
      console.log("Not authenticated, redirecting to:", redirectTo);
      navigate(redirectTo);
      return false;
    }
    return true;
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    requireAuth,
    checkAuthState,
    isCurrentlyAuthenticated
  };
}; 
