import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { PlusIcon, TrashIcon, PencilIcon, ArrowLeftIcon, InformationCircleIcon, ChevronDownIcon, ChevronRightIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getZoneById, getAreas, deleteArea, getDeployments, deleteDeployment, updateDeployment, getDeploymentById, createDeployment } from '../services/api';
import { Zone, Area } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/ConfirmationModal';
import toast from 'react-hot-toast';

// Define deployment summary interface
interface DeploymentSummary {
  id: number;
  area_name: string;
  zone_name: string;
  si_count: number;
  asi_count: number;
  hc_count: number;
  constable_count: number;
  hgv_count: number;
  driver_count: number;
  senior_count: number;
  created_at: string;
  updated_at: string;
  area: number;
}

const ZoneAreas: React.FC = () => {
  const params = useParams<{ id?: string }>();
  const zoneId = params.id ? parseInt(params.id) : undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const [zone, setZone] = useState<Zone | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [deployments, setDeployments] = useState<{[areaId: number]: DeploymentSummary[]}>({});
  const [expandedAreas, setExpandedAreas] = useState<{[areaId: number]: boolean}>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);
  const [deleteDeploymentConfirm, setDeleteDeploymentConfirm] = useState<{id: number, areaId: number} | null>(null);
  const [editingDeployment, setEditingDeployment] = useState<{id: number, areaId: number} | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<DeploymentSummary>>({});
  const [savingDeployment, setSavingDeployment] = useState(false);
  // Add new state variables for deployment creation form
  const [showAddDeploymentForm, setShowAddDeploymentForm] = useState<number | null>(null);
  const [newDeploymentData, setNewDeploymentData] = useState({
    si_count: 0,
    asi_count: 0,
    hc_count: 0,
    constable_count: 0,
    hgv_count: 0,
    driver_count: 0,
    senior_count: 0
  });
  const [creatingDeployment, setCreatingDeployment] = useState(false);

  // Parse query parameters
  const queryParams = new URLSearchParams(location.search);
  const editDeploymentId = queryParams.get('editDeployment');

  // Fetch zone and areas
  const fetchZoneAndAreas = async () => {
    if (!zoneId) {
      console.error("No zone ID provided in URL params:", params);
      setError("No zone ID provided. Please select a zone from the zones list.");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching zone with ID: ${zoneId}`);
      
      // Fetch zone details
      const zoneData = await getZoneById(zoneId);
      console.log("Zone data fetched successfully:", zoneData);
      setZone(zoneData);
      
      // Fetch areas for this zone - using the correct API endpoint with query parameter
      console.log(`Fetching areas for zone ID: ${zoneId}`);
      const areasData = await getAreas(zoneId); // Using the correct parameter format
      console.log("Areas data fetched successfully:", areasData);
      setAreas(areasData || []);

      // Initialize expanded state for all areas
      const expandedState = areasData.reduce((acc: {[areaId: number]: boolean}, area) => {
        acc[area.id] = false;
        return acc;
      }, {});
      setExpandedAreas(expandedState);

      // Check if we should auto-expand to a specific deployment for editing
      if (editDeploymentId) {
        await handleAutoExpandForDeployment(parseInt(editDeploymentId), areasData);
      }
    } catch (err) {
      console.error('Error fetching zone and areas:', err);
      setError('Failed to load zone and areas data. Please try again later.');
      // Set default values even on error to prevent endless loading
      if (!zone) setZone({ id: zoneId, name: "Unknown Zone", description: null });
      if (!areas.length) setAreas([]);
    } finally {
      setLoading(false);
    }
  };

  // Automatically expand and edit a deployment when directed here via URL
  const handleAutoExpandForDeployment = async (deploymentId: number, areasData: Area[]) => {
    try {
      // Get the deployment
      const deployment = await getDeploymentById(deploymentId);
      const areaId = deployment.area;
      
      // Fetch deployments for this area
      await fetchDeploymentsForArea(areaId);
      
      // Expand the area
      setExpandedAreas(prev => ({
        ...prev,
        [areaId]: true
      }));
      
      // Set the deployment for editing
      // We need to wait for deployments to be loaded before setting up edit mode
      setTimeout(() => {
        const deploymentData = deployments[areaId]?.find(d => d.id === deploymentId);
        if (deploymentData) {
          handleEditDeployment(deploymentData);
        }
      }, 500);
      
      // Remove the query parameter to avoid re-triggering on refresh
      navigate(`/zones/${zoneId}/areas`, { replace: true });
    } catch (err) {
      console.error('Error setting up auto-expanded deployment:', err);
      toast.error('Failed to load the deployment for editing');
    }
  };

  // Fetch deployments for a specific area
  const fetchDeploymentsForArea = async (areaId: number) => {
    try {
      console.log(`Fetching deployments for area ID: ${areaId}`);
      const deploymentsData = await getDeployments({ area: areaId });
      console.log(`Deployments for area ${areaId} fetched:`, deploymentsData);
      
      setDeployments(prev => ({
        ...prev,
        [areaId]: deploymentsData as DeploymentSummary[]
      }));
      
      return deploymentsData;
    } catch (err) {
      console.error(`Error fetching deployments for area ${areaId}:`, err);
      toast.error(`Failed to load deployments for area ID: ${areaId}`);
      return [];
    }
  };

  // Toggle area expansion
  const toggleAreaExpand = async (areaId: number) => {
    const newExpandedState = !expandedAreas[areaId];
    
    setExpandedAreas(prev => ({
      ...prev,
      [areaId]: newExpandedState
    }));
    
    // If expanding and we don't have deployments for this area yet, fetch them
    if (newExpandedState && (!deployments[areaId] || deployments[areaId].length === 0)) {
      await fetchDeploymentsForArea(areaId);
    }
  };

  useEffect(() => {
    console.log("ZoneAreas component mounted or zoneId changed:", zoneId);
    fetchZoneAndAreas();
  }, [zoneId]);

  // Listen for changes to editDeploymentId
  useEffect(() => {
    if (editDeploymentId && !loading && areas.length > 0) {
      handleAutoExpandForDeployment(parseInt(editDeploymentId), areas);
    }
  }, [editDeploymentId, loading, areas.length]);

  // Handle area deletion
  const handleDeleteClick = (area: Area) => {
    setAreaToDelete(area);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!areaToDelete) return;
    
    try {
      await deleteArea(areaToDelete.id);
      setAreas(areas.filter(a => a.id !== areaToDelete.id));
      toast.success(`Area "${areaToDelete.name}" deleted successfully`);
    } catch (err) {
      console.error('Error deleting area:', err);
      toast.error('Failed to delete area. Please try again.');
    } finally {
      setShowDeleteConfirm(false);
      setAreaToDelete(null);
    }
  };

  // Handle deployment deletion
  const handleDeleteDeployment = (deploymentId: number, areaId: number) => {
    setDeleteDeploymentConfirm({ id: deploymentId, areaId });
  };

  const confirmDeleteDeployment = async () => {
    if (!deleteDeploymentConfirm) return;
    
    try {
      await deleteDeployment(deleteDeploymentConfirm.id);
      
      // Update the deployments state to remove the deleted deployment
      setDeployments(prev => ({
        ...prev,
        [deleteDeploymentConfirm.areaId]: prev[deleteDeploymentConfirm.areaId].filter(
          d => d.id !== deleteDeploymentConfirm.id
        )
      }));
      
      toast.success('Deployment deleted successfully');
    } catch (err) {
      console.error('Error deleting deployment:', err);
      toast.error('Failed to delete deployment. Please try again.');
    } finally {
      setDeleteDeploymentConfirm(null);
    }
  };

  const cancelDeleteDeployment = () => {
    setDeleteDeploymentConfirm(null);
  };

  // Handle deployment editing
  const handleEditDeployment = (deployment: DeploymentSummary) => {
    setEditingDeployment({ id: deployment.id, areaId: deployment.area });
    setEditFormData({ ...deployment });
  };

  const handleCancelEdit = () => {
    setEditingDeployment(null);
    setEditFormData({});
  };

  const handleEditFormChange = (field: keyof DeploymentSummary, value: number) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingDeployment) return;
    
    setSavingDeployment(true);
    try {
      const updateData = {
        si_count: editFormData.si_count,
        asi_count: editFormData.asi_count,
        hc_count: editFormData.hc_count,
        constable_count: editFormData.constable_count,
        hgv_count: editFormData.hgv_count,
        driver_count: editFormData.driver_count,
        senior_count: editFormData.senior_count,
        area: editFormData.area
      };
      
      const updatedDeployment = await updateDeployment(editingDeployment.id, updateData);
      
      // Update the state with the updated deployment
      setDeployments(prev => {
        const areaDeployments = [...prev[editingDeployment.areaId]];
        const index = areaDeployments.findIndex(d => d.id === editingDeployment.id);
        if (index !== -1) {
          areaDeployments[index] = updatedDeployment as DeploymentSummary;
        }
        return {
          ...prev,
          [editingDeployment.areaId]: areaDeployments
        };
      });
      
      toast.success('Deployment updated successfully');
      setEditingDeployment(null);
      setEditFormData({});
    } catch (err) {
      console.error('Error updating deployment:', err);
      toast.error('Failed to update deployment. Please try again.');
    } finally {
      setSavingDeployment(false);
    }
  };

  // Filter areas based on search term
  const filteredAreas = areas.filter(area => 
    area.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Add this function to handle creating a new deployment
  const handleCreateDeployment = async (areaId: number) => {
    setCreatingDeployment(true);
    try {
      const deploymentData = {
        ...newDeploymentData,
        area: areaId
      };
      
      const createdDeployment = await createDeployment(deploymentData);
      
      // Update the state with the new deployment
      setDeployments(prev => ({
        ...prev,
        [areaId]: [...(prev[areaId] || []), createdDeployment as DeploymentSummary]
      }));
      
      // Reset the form and state
      setNewDeploymentData({
        si_count: 0,
        asi_count: 0,
        hc_count: 0,
        constable_count: 0,
        hgv_count: 0,
        driver_count: 0,
        senior_count: 0
      });
      setShowAddDeploymentForm(null);
      toast.success('Deployment created successfully');
    } catch (err) {
      console.error('Error creating deployment:', err);
      toast.error('Failed to create deployment. Please try again.');
    } finally {
      setCreatingDeployment(false);
    }
  };

  // Add this function to handle form field changes
  const handleNewDeploymentChange = (field: string, value: number) => {
    setNewDeploymentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex h-full justify-center items-center p-10">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading zone and areas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex justify-between w-full">
              <p className="text-sm">{error}</p>
              <button 
                onClick={fetchZoneAndAreas}
                className="text-sm font-medium text-red-600 hover:text-red-800"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back button and header */}
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate('/zones')}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold flex-1">
          {zone?.name || 'Zone Details'}
        </h1>
        {zoneId && (
          <Link 
            to={`/zones/${zoneId}/areas/new`}
            className="flex items-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            <PlusIcon className="h-5 w-5 mr-1" />
            Add Area
          </Link>
        )}
      </div>

      {/* Search and info */}
      <div className="mb-6 flex justify-between">
        <div className="w-full max-w-xs">
          <input
            type="text"
            placeholder="Search areas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-md"
          />
        </div>
        <div className="text-gray-600 flex items-center">
          <InformationCircleIcon className="h-5 w-5 mr-1" />
          <span>Total Areas: {areas.length}</span>
        </div>
      </div>

      {/* Areas list */}
      {filteredAreas.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 text-lg">No areas found for this zone.</p>
          {zoneId && (
            <Link 
              to={`/zones/${zoneId}/areas/new`}
              className="mt-4 inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              <PlusIcon className="h-5 w-5 inline mr-1" />
              Add your first area
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Expand
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Area Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Call Sign
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAreas.map((area) => (
                  <React.Fragment key={area.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => toggleAreaExpand(area.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedAreas[area.id] ? (
                            <ChevronDownIcon className="h-5 w-5" />
                          ) : (
                            <ChevronRightIcon className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {area.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {area.call_sign}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {area.vehicle_no || <span className="text-gray-400 italic">Not assigned</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {zoneId && (
                            <>
                              <button 
                                onClick={() => toggleAreaExpand(area.id)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                {expandedAreas[area.id] ? 'Hide Deployments' : 'Show Deployments'}
                              </button>
                              <Link 
                                to={`/zones/${zoneId}/areas/${area.id}/edit`}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </Link>
                              <button 
                                onClick={() => handleDeleteClick(area)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedAreas[area.id] && (
                      <tr>
                        <td colSpan={5} className="px-0 py-0">
                          <div className="bg-gray-50 border-t border-gray-200 p-4">
                            <div className="flex justify-between mb-4">
                              <h3 className="text-lg font-medium">Deployments for {area.name}</h3>
                              <button 
                                onClick={() => setShowAddDeploymentForm(area.id)}
                                className="flex items-center text-indigo-600 hover:text-indigo-900"
                              >
                                <PlusIcon className="h-4 w-4 mr-1" />
                                Add Deployment
                              </button>
                            </div>
                            
                            {showAddDeploymentForm === area.id && (
                              <div className="bg-blue-50 p-4 rounded-md shadow-inner mb-4">
                                <h4 className="text-md font-medium mb-3">New Deployment for {area.name}</h4>
                                <div className="grid grid-cols-7 gap-2 mb-4">
                                  <div>
                                    <label className="block text-xs text-gray-700 mb-1">SI</label>
                                    <input 
                                      type="number" 
                                      value={newDeploymentData.si_count}
                                      onChange={(e) => handleNewDeploymentChange('si_count', parseInt(e.target.value) || 0)}
                                      min="0"
                                      className="w-full px-2 py-1 border rounded text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-700 mb-1">ASI</label>
                                    <input 
                                      type="number" 
                                      value={newDeploymentData.asi_count}
                                      onChange={(e) => handleNewDeploymentChange('asi_count', parseInt(e.target.value) || 0)}
                                      min="0"
                                      className="w-full px-2 py-1 border rounded text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-700 mb-1">HC</label>
                                    <input 
                                      type="number" 
                                      value={newDeploymentData.hc_count}
                                      onChange={(e) => handleNewDeploymentChange('hc_count', parseInt(e.target.value) || 0)}
                                      min="0"
                                      className="w-full px-2 py-1 border rounded text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-700 mb-1">Const.</label>
                                    <input 
                                      type="number" 
                                      value={newDeploymentData.constable_count}
                                      onChange={(e) => handleNewDeploymentChange('constable_count', parseInt(e.target.value) || 0)}
                                      min="0"
                                      className="w-full px-2 py-1 border rounded text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-700 mb-1">HGV</label>
                                    <input 
                                      type="number" 
                                      value={newDeploymentData.hgv_count}
                                      onChange={(e) => handleNewDeploymentChange('hgv_count', parseInt(e.target.value) || 0)}
                                      min="0"
                                      className="w-full px-2 py-1 border rounded text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-700 mb-1">Driver</label>
                                    <input 
                                      type="number" 
                                      value={newDeploymentData.driver_count}
                                      onChange={(e) => handleNewDeploymentChange('driver_count', parseInt(e.target.value) || 0)}
                                      min="0"
                                      className="w-full px-2 py-1 border rounded text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-700 mb-1">Senior</label>
                                    <input 
                                      type="number" 
                                      value={newDeploymentData.senior_count}
                                      onChange={(e) => handleNewDeploymentChange('senior_count', parseInt(e.target.value) || 0)}
                                      min="0"
                                      className="w-full px-2 py-1 border rounded text-center"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={() => setShowAddDeploymentForm(null)}
                                    className="text-gray-600 hover:text-gray-900 px-3 py-1 border rounded"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleCreateDeployment(area.id)}
                                    disabled={creatingDeployment}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded flex items-center"
                                  >
                                    {creatingDeployment ? (
                                      <LoadingSpinner size="small" />
                                    ) : (
                                      <>Save</>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {!deployments[area.id] ? (
                              <div className="text-center p-4">
                                <LoadingSpinner size="small" />
                                <p className="mt-2 text-gray-500">Loading deployments...</p>
                              </div>
                            ) : deployments[area.id]?.length === 0 ? (
                              <div className="text-center p-4">
                                <p className="text-gray-500">No deployments found for this area.</p>
                                <button 
                                  onClick={() => setShowAddDeploymentForm(area.id)}
                                  className="mt-2 inline-block text-indigo-600 hover:text-indigo-900"
                                >
                                  Create first deployment
                                </button>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ID
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        SI
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ASI
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        HC
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Const.
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        HGV
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Driver
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Senior
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {deployments[area.id]?.map((deployment) => (
                                      <React.Fragment key={deployment.id}>
                                        {editingDeployment?.id === deployment.id ? (
                                          <tr className="bg-blue-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                              {deployment.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {formatDate(deployment.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                              <input 
                                                type="number" 
                                                value={editFormData.si_count || 0}
                                                onChange={(e) => handleEditFormChange('si_count', parseInt(e.target.value))}
                                                min="0"
                                                className="w-16 px-2 py-1 border rounded text-center"
                                              />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                              <input 
                                                type="number" 
                                                value={editFormData.asi_count || 0}
                                                onChange={(e) => handleEditFormChange('asi_count', parseInt(e.target.value))}
                                                min="0"
                                                className="w-16 px-2 py-1 border rounded text-center"
                                              />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                              <input 
                                                type="number" 
                                                value={editFormData.hc_count || 0}
                                                onChange={(e) => handleEditFormChange('hc_count', parseInt(e.target.value))}
                                                min="0"
                                                className="w-16 px-2 py-1 border rounded text-center"
                                              />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                              <input 
                                                type="number" 
                                                value={editFormData.constable_count || 0}
                                                onChange={(e) => handleEditFormChange('constable_count', parseInt(e.target.value))}
                                                min="0"
                                                className="w-16 px-2 py-1 border rounded text-center"
                                              />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                              <input 
                                                type="number" 
                                                value={editFormData.hgv_count || 0}
                                                onChange={(e) => handleEditFormChange('hgv_count', parseInt(e.target.value))}
                                                min="0"
                                                className="w-16 px-2 py-1 border rounded text-center"
                                              />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                              <input 
                                                type="number" 
                                                value={editFormData.driver_count || 0}
                                                onChange={(e) => handleEditFormChange('driver_count', parseInt(e.target.value))}
                                                min="0"
                                                className="w-16 px-2 py-1 border rounded text-center"
                                              />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                              <input 
                                                type="number" 
                                                value={editFormData.senior_count || 0}
                                                onChange={(e) => handleEditFormChange('senior_count', parseInt(e.target.value))}
                                                min="0"
                                                className="w-16 px-2 py-1 border rounded text-center"
                                              />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                              <div className="flex space-x-3">
                                                <button
                                                  onClick={handleSaveEdit}
                                                  disabled={savingDeployment}
                                                  className="text-green-600 hover:text-green-900 flex items-center"
                                                >
                                                  {savingDeployment ? (
                                                    <LoadingSpinner size="small" />
                                                  ) : (
                                                    <CheckIcon className="h-5 w-5" />
                                                  )}
                                                  <span className="ml-1">Save</span>
                                                </button>
                                                <button
                                                  onClick={handleCancelEdit}
                                                  className="text-gray-600 hover:text-gray-900 flex items-center"
                                                >
                                                  <XMarkIcon className="h-5 w-5" />
                                                  <span className="ml-1">Cancel</span>
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ) : (
                                          <tr className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                              {deployment.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {formatDate(deployment.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {deployment.si_count}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {deployment.asi_count}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {deployment.hc_count}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {deployment.constable_count}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {deployment.hgv_count}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {deployment.driver_count}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {deployment.senior_count}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                              <div className="flex space-x-3">
                                                <button
                                                  onClick={() => handleEditDeployment(deployment)}
                                                  className="text-indigo-600 hover:text-indigo-900"
                                                >
                                                  <PencilIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteDeployment(deployment.id, area.id)}
                                                  className="text-red-600 hover:text-red-900"
                                                >
                                                  <TrashIcon className="h-5 w-5" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete area confirmation modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Area"
        message={`Are you sure you want to delete the area "${areaToDelete?.name}"? This action cannot be undone.`}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
      />

      {/* Delete deployment confirmation modal */}
      <ConfirmationModal
        isOpen={deleteDeploymentConfirm !== null}
        onClose={cancelDeleteDeployment}
        onConfirm={confirmDeleteDeployment}
        title="Delete Deployment"
        message={`Are you sure you want to delete this deployment? This action cannot be undone.`}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
      />
    </div>
  );
};

export default ZoneAreas; 