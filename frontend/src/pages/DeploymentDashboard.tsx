import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { getDeployments, getZones, getAreas } from '../services/api';
import { Deployment, Zone, Area } from '../types';
import DeploymentStatsBadge from '../components/deployments/DeploymentStatsBadge';
import { Link } from 'react-router-dom';
import { MapPinIcon, UserGroupIcon, ExclamationCircleIcon, PlusIcon } from '@heroicons/react/24/outline';

interface DeploymentStat {
  si_count: number;
  asi_count: number;
  hc_count: number;
  constable_count: number;
  hgv_count: number;
  driver_count: number;
  senior_count: number;
  total_count: number;
}

interface ZoneStats extends DeploymentStat {
  id: number;
  name: string;
  areas: AreaStats[];
}

interface AreaStats extends DeploymentStat {
  id: number;
  name: string;
  call_sign: string;
  vehicle_no?: string | null;
  zone_id: number;
  zone_name: string;
}

const DeploymentDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoneStats, setZoneStats] = useState<ZoneStats[]>([]);
  const [activeZone, setActiveZone] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const calculateDeploymentStats = (deployments: any[]): DeploymentStat => {
    return deployments.reduce((stats, deployment) => ({
      si_count: stats.si_count + (deployment.si_count || 0),
      asi_count: stats.asi_count + (deployment.asi_count || 0),
      hc_count: stats.hc_count + (deployment.hc_count || 0),
      constable_count: stats.constable_count + (deployment.constable_count || 0),
      hgv_count: stats.hgv_count + (deployment.hgv_count || 0),
      driver_count: stats.driver_count + (deployment.driver_count || 0),
      senior_count: stats.senior_count + (deployment.senior_count || 0),
      total_count: stats.total_count + (
        (deployment.si_count || 0) +
        (deployment.asi_count || 0) +
        (deployment.hc_count || 0) +
        (deployment.constable_count || 0) +
        (deployment.hgv_count || 0) +
        (deployment.driver_count || 0) +
        (deployment.senior_count || 0)
      )
    }), {
      si_count: 0,
      asi_count: 0,
      hc_count: 0,
      constable_count: 0,
      hgv_count: 0,
      driver_count: 0,
      senior_count: 0,
      total_count: 0
    });
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [zonesData, areasData, deploymentsData] = await Promise.all([
        getZones(),
        getAreas(),
        getDeployments()
      ]);

      if (!zonesData || zonesData.length === 0) {
        setError('No zones found. Please create zones first.');
        setIsLoading(false);
        setZoneStats([]);
        return;
      }

      // Group deployments by zone name
      const deploymentsByZone = new Map<string, any[]>();
      
      deploymentsData.forEach(deployment => {
        const zoneName = deployment.zone_name;
        if (!deploymentsByZone.has(zoneName)) {
          deploymentsByZone.set(zoneName, []);
        }
        deploymentsByZone.get(zoneName)?.push(deployment);
      });

      // Create zone stats with aggregated deployment counts
      const zoneStatsData = zonesData.map(zone => {
        const zoneDeployments = deploymentsByZone.get(zone.name) || [];
        const zoneAreas = areasData.filter(area => area.zone === zone.id);

        // Calculate zone totals directly from deployments
        const zoneTotals = {
          si_count: 0,
          asi_count: 0,
          hc_count: 0,
          constable_count: 0,
          hgv_count: 0,
          driver_count: 0,
          senior_count: 0,
          total_count: 0
        };

        zoneDeployments.forEach(deployment => {
          zoneTotals.si_count += deployment.si_count || 0;
          zoneTotals.asi_count += deployment.asi_count || 0;
          zoneTotals.hc_count += deployment.hc_count || 0;
          zoneTotals.constable_count += deployment.constable_count || 0;
          zoneTotals.hgv_count += deployment.hgv_count || 0;
          zoneTotals.driver_count += deployment.driver_count || 0;
          zoneTotals.senior_count += deployment.senior_count || 0;
        });

        zoneTotals.total_count = 
          zoneTotals.si_count + 
          zoneTotals.asi_count + 
          zoneTotals.hc_count + 
          zoneTotals.constable_count + 
          zoneTotals.hgv_count + 
          zoneTotals.driver_count + 
          zoneTotals.senior_count;

        // Calculate area stats
        const areaStats = zoneAreas.map(area => {
          const areaDeployments = deploymentsData.filter(d => d.area === area.id);
          const stats = {
            id: area.id,
            name: area.name,
            call_sign: area.call_sign,
            vehicle_no: area.vehicle_no,
            zone_id: zone.id,
            zone_name: zone.name,
            si_count: 0,
            asi_count: 0,
            hc_count: 0,
            constable_count: 0,
            hgv_count: 0,
            driver_count: 0,
            senior_count: 0,
            total_count: 0
          };

          areaDeployments.forEach(deployment => {
            stats.si_count += deployment.si_count || 0;
            stats.asi_count += deployment.asi_count || 0;
            stats.hc_count += deployment.hc_count || 0;
            stats.constable_count += deployment.constable_count || 0;
            stats.hgv_count += deployment.hgv_count || 0;
            stats.driver_count += deployment.driver_count || 0;
            stats.senior_count += deployment.senior_count || 0;
          });

          stats.total_count = 
            stats.si_count + 
            stats.asi_count + 
            stats.hc_count + 
            stats.constable_count + 
            stats.hgv_count + 
            stats.driver_count + 
            stats.senior_count;

          return stats;
        });

        return {
          id: zone.id,
          name: zone.name,
          ...zoneTotals,
          areas: areaStats
        };
      });

      setZoneStats(zoneStatsData);
    } catch (err) {
      console.error('Error fetching deployment dashboard data:', err);
      setError('Failed to load deployment data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleZone = (zoneId: number) => {
    if (activeZone === zoneId) {
      setActiveZone(null);
    } else {
      setActiveZone(zoneId);
    }
  };

  const handleRetry = () => {
    fetchData();
  };
  
  const renderNoBadge = () => (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      No Deployments
    </span>
  );

  const RankCountDisplay = ({ stats }: { stats: DeploymentStat }) => (
    <div className="mt-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">SI:</span>
        <span className="font-medium">{stats.si_count}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">ASI:</span>
        <span className="font-medium">{stats.asi_count}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">HC:</span>
        <span className="font-medium">{stats.hc_count}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Constable:</span>
        <span className="font-medium">{stats.constable_count}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">HGV:</span>
        <span className="font-medium">{stats.hgv_count}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Drivers:</span>
        <span className="font-medium">{stats.driver_count}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Senior Officers:</span>
        <span className="font-medium">{stats.senior_count}</span>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-10">
          <div className="spinner mx-auto h-12 w-12 border-4 border-t-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading deployment data...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Deployment Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of all zone and area deployments
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm">{error}</p>
                <div className="mt-2">
                  <button
                    onClick={handleRetry}
                    className="px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {zoneStats.length === 0 && !error ? (
          <div className="bg-white rounded-lg shadow overflow-hidden text-center py-8">
            <MapPinIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No zones found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating zones and areas to track deployments.
            </p>
            <div className="mt-6">
              <Link
                to="/zones/new"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                Add New Zone
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Zone stats cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
              {zoneStats.map(zone => (
                <div 
                  key={zone.id}
                  className={`bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${activeZone === zone.id ? 'ring-2 ring-indigo-500' : ''}`}
                  onClick={() => toggleZone(zone.id)}
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{zone.name}</h3>
                        <p className="text-sm text-gray-500">
                          {zone.areas.length} {zone.areas.length === 1 ? 'Area' : 'Areas'}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Total: {zone.total_count}
                      </span>
                    </div>
                    
                    <RankCountDisplay stats={zone} />
                    
                    <div className="mt-4 flex justify-end">
                      <Link
                        to={`/zones/${zone.id}/areas`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Area details when a zone is selected */}
            {activeZone !== null && (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    Areas in {zoneStats.find(z => z.id === activeZone)?.name}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Detailed deployment statistics for each area
                  </p>
                </div>
                
                <div className="border-t border-gray-200">
                  <ul className="divide-y divide-gray-200">
                    {zoneStats
                      .find(z => z.id === activeZone)
                      ?.areas.map(area => (
                        <li key={area.id} className="px-4 py-4 sm:px-6">
                          <div className="flex items-start justify-between">
                            <div className="flex flex-col flex-grow">
                              <div className="flex items-center">
                                <MapPinIcon className="h-5 w-5 text-gray-400 mr-2" />
                                <h4 className="text-md font-medium text-gray-900">{area.name}</h4>
                              </div>
                              
                              <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Call Sign: {area.call_sign}
                                </span>
                                {area.vehicle_no && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Vehicle: {area.vehicle_no}
                                  </span>
                                )}
                              </div>
                              
                              <RankCountDisplay stats={area} />
                            </div>
                            
                            <Link
                              to={`/areas/${area.id}/deployments`}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <UserGroupIcon className="-ml-1 mr-2 h-4 w-4" />
                              Manage Deployments
                            </Link>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default DeploymentDashboard; 