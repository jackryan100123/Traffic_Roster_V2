import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './services/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Policemen from './pages/Policemen';
import AddPoliceman from './pages/AddPoliceman';
import EditPoliceman from './pages/EditPoliceman';

import Zones from './pages/Zones';
import AddZone from './pages/AddZone';
import EditZone from './pages/EditZone';
import ZoneAreas from './pages/ZoneAreas';
import AddArea from './pages/AddArea';
import EditArea from './pages/EditArea';
// Import deployment related pages
import Deployments from './pages/Deployments';
import AreaDeployments from './pages/AreaDeployments';
import AddDeployment from './pages/AddDeployment';
import EditDeployment from './pages/EditDeployment';
import DeploymentDashboard from './pages/DeploymentDashboard';
import ToastProvider from './components/ToastProvider';
// Import Roster Portal components
import RosterNavbar from './components/RosterNavbar';
import StaticPolice from './pages/StaticPolice';
import FixedPolice from './pages/FixedPolice';
import RosterGenerator from './pages/RosterGenerator';
import './App.css';
import { Toaster } from 'react-hot-toast';

// Auth protected route component
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const auth = isAuthenticated();
  
  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="spinner"></div>
          <p className="mt-4 text-gray-600">Loading Police Roster System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastProvider>
        <Router>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            {/* Policemen Routes */}
            <Route path="/policemen" element={
              <ProtectedRoute>
                <Policemen />
              </ProtectedRoute>
            } />
            <Route path="/policemen/new" element={
              <ProtectedRoute>
                <AddPoliceman />
              </ProtectedRoute>
            } />
            <Route path="/policemen/edit/:id" element={
              <ProtectedRoute>
                <EditPoliceman />
              </ProtectedRoute>
            } />
            
            {/* Zone Routes */}
            <Route path="/zones" element={
              <ProtectedRoute>
                <Zones />
              </ProtectedRoute>
            } />
            <Route path="/zones/new" element={
              <ProtectedRoute>
                <AddZone />
              </ProtectedRoute>
            } />
            <Route path="/zones/edit/:id" element={
              <ProtectedRoute>
                <EditZone />
              </ProtectedRoute>
            } />
            <Route path="/zones/:id/areas" element={
              <ProtectedRoute>
                <ZoneAreas />
              </ProtectedRoute>
            } />
            
            {/* Area Routes */}
            <Route path="/zones/:zoneId/areas/new" element={
              <ProtectedRoute>
                <AddArea />
              </ProtectedRoute>
            } />
            <Route path="/areas/edit/:areaId" element={
              <ProtectedRoute>
                <EditArea />
              </ProtectedRoute>
            } />
            
            {/* Deployment Routes */}
            <Route path="/deployments" element={
              <ProtectedRoute>
                <Deployments />
              </ProtectedRoute>
            } />
            <Route path="/deployment-dashboard" element={
              <ProtectedRoute>
                <DeploymentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/areas/:areaId/deployments" element={
              <ProtectedRoute>
                <AreaDeployments />
              </ProtectedRoute>
            } />
            <Route path="/areas/:areaId/deployments/new" element={
              <ProtectedRoute>
                <AddDeployment />
              </ProtectedRoute>
            } />
            <Route path="/deployments/edit/:deploymentId" element={
              <ProtectedRoute>
                <EditDeployment />
              </ProtectedRoute>
            } />
            
            {/* Roster Portal Routes with Navbar */}
            <Route
              path="/static-police"
              element={
                <div className="min-h-screen bg-gray-50">
                  <RosterNavbar />
                  <StaticPolice />
                </div>
              }
            />
            <Route
              path="/fixed-police"
              element={
                <div className="min-h-screen bg-gray-50">
                  <RosterNavbar />
                  <FixedPolice />
                </div>
              }
            />
            <Route
              path="/roster-generator"
              element={
                <div className="min-h-screen bg-gray-50">
                  <RosterNavbar />
                  <RosterGenerator />
                </div>
              }
            />
            
            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </div>
  );
}

export default App;
