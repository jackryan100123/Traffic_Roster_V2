import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { getDeployments, getAreas, getZones } from '../services/api';
import { Area, Zone } from '../types';
import { Deployment as DeploymentType } from '../types';
import { PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

const Deployments = () => {
  const [deployments, setDeployments] = useState<DeploymentType[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedZone, setSelectedZone] = useState<number | ''>('');
  const [selectedArea, setSelectedArea] = useState<number | ''>('');
  const [selectedDutyType, setSelectedDutyType] = useState<string>('');
  
  // Filtered areas based on selected zone
  const [filteredAreas, setFilteredAreas] = useState<Area[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [deploymentsData, areasData, zonesData] = await Promise.all([
          getDeployments(),
          getAreas(),
          getZones()
        ]);
        
        // Cast the deployment data to the expected type
        setDeployments(deploymentsData as unknown as DeploymentType[]);
        setAreas(areasData);
        setZones(zonesData);
        setFilteredAreas(areasData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load deployments. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // When zone filter changes, update the area filter options
  useEffect(() => {
    if (selectedZone === '') {
      setFilteredAreas(areas);
      return;
    }
    
    const filtered = areas.filter(area => area.zone === selectedZone);
    setFilteredAreas(filtered);
    
    // Reset area selection if the current selection doesn't belong to the selected zone
    if (selectedArea !== '' && !filtered.some(area => area.id === selectedArea)) {
      setSelectedArea('');
    }
  }, [selectedZone, areas, selectedArea]);

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedZone(value === '' ? '' : parseInt(value, 10));
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedArea(value === '' ? '' : parseInt(value, 10));
  };

  const handleDutyTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDutyType(e.target.value);
  };

  const resetFilters = () => {
    setSelectedZone('');
    setSelectedArea('');
    setSelectedDutyType('');
  };

  // Filter deployments based on selected filters
  const filteredDeployments = deployments.filter(deployment => {
    const matchesArea = selectedArea === '' || deployment.area === selectedArea;
    const matchesDutyType = selectedDutyType === '' || deployment.duty_type === selectedDutyType;
    
    // If a zone is selected but no area, check if the deployment's area belongs to that zone
    let matchesZone = true;
    if (selectedZone !== '' && selectedArea === '') {
      const deploymentArea = areas.find(area => area.id === deployment.area);
      matchesZone = deploymentArea ? deploymentArea.zone === selectedZone : false;
    }
    
    return matchesArea && matchesDutyType && matchesZone;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAreaDetails = (areaId: number) => {
    const area = areas.find(a => a.id === areaId);
    return area ? { name: area.name, call_sign: area.call_sign } : { name: 'Unknown', call_sign: 'Unknown' };
  };

  return (
    <Layout>
      <div className="pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Deployments</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage all deployments across different areas.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-lg font-medium mb-4">Filters</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="zone" className="block text-sm font-medium text-gray-700">
                Zone
              </label>
              <select
                id="zone"
                name="zone"
                value={selectedZone}
                onChange={handleZoneChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">All Zones</option>
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="area" className="block text-sm font-medium text-gray-700">
                Area
              </label>
              <select
                id="area"
                name="area"
                value={selectedArea}
                onChange={handleAreaChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">All Areas</option>
                {filteredAreas.map(area => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({area.call_sign})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="dutyType" className="block text-sm font-medium text-gray-700">
                Duty Type
              </label>
              <select
                id="dutyType"
                name="dutyType"
                value={selectedDutyType}
                onChange={handleDutyTypeChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">All Types</option>
                <option value="FIELD">FIELD</option>
                <option value="STATIC">STATIC</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <div className="spinner"></div>
            <p className="mt-2 text-gray-600">Loading deployments data...</p>
          </div>
        ) : filteredDeployments.length === 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No deployments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No deployments match your filter criteria or no deployments exist.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-4"
                >
                  Reset Filters
                </button>
                <Link
                  to="/areas"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  View Areas
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {filteredDeployments.map((deployment) => {
                const areaDetails = getAreaDetails(deployment.area);
                return (
                  <li key={deployment.id}>
                    <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <h3 className="text-lg font-medium text-gray-900">
                            {deployment.policeman_name}
                          </h3>
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {deployment.policeman_rank}
                          </span>
                          {deployment.is_driver && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Driver
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          Deployed to: <span className="font-medium">{areaDetails.name}</span> (Call Sign: {areaDetails.call_sign})
                        </div>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <span className="mr-2">
                            Duty Type: <span className="font-medium">{deployment.duty_type}</span>
                          </span>
                          •
                          <span className="mx-2">
                            From: <span className="font-medium">{formatDate(deployment.start_date)}</span>
                          </span>
                          {deployment.end_date && (
                            <>
                              •
                              <span className="mx-2">
                                To: <span className="font-medium">{formatDate(deployment.end_date)}</span>
                              </span>
                            </>
                          )}
                        </div>
                        {deployment.notes && (
                          <p className="mt-1 text-sm text-gray-500">{deployment.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <Link
                          to={`/deployments/edit/${deployment.id}`}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-100 transition-colors"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </Link>
                        <Link
                          to={`/areas/${deployment.area}/deployments`}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          View Area
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Deployments; 