import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { getPolicemen, getActiveRosters, getPendingRosters, getPreviousRosters } from '../services/api';


const Dashboard = () => {
  const [summary, setSummary] = useState({
    totalPolicemen: 0,
    drivers: 0,
    fieldOfficers: 0,
    staticOfficers: 0,
    fixedDuty: 0,
  });
  const [rosterSummary, setRosterSummary] = useState({
    activeRosters: 0,
    pendingRosters: 0,
    previousRosters: 0,
    totalOfficersAssigned: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const policemen = await getPolicemen();
        
        // Calculate summary
        const totalPolicemen = policemen.length;
        const drivers = policemen.filter(p => p.is_driver).length;
        const fieldOfficers = policemen.filter(p => p.preferred_duty === 'FIELD').length;
        const staticOfficers = policemen.filter(p => p.preferred_duty === 'STATIC').length;
        const fixedDuty = policemen.filter(p => p.has_fixed_duty).length;
        
        setSummary({
          totalPolicemen,
          drivers,
          fieldOfficers,
          staticOfficers,
          fixedDuty,
        });

        // Fetch roster data
        const activeRosters = await getActiveRosters();
        const pendingRosters = await getPendingRosters();
        const previousRosters = await getPreviousRosters();

        // Calculate assigned officers from active rosters
        const totalOfficersAssigned = activeRosters.reduce((total: number, roster: any) => {
          return total + (roster.assignments?.length || 0);
        }, 0);

        setRosterSummary({
          activeRosters: Array.isArray(activeRosters) ? activeRosters.length : 0,
          pendingRosters: Array.isArray(pendingRosters) ? pendingRosters.length : 0,
          previousRosters: Array.isArray(previousRosters) ? previousRosters.length : 0,
          totalOfficersAssigned
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Layout>
      <div className="pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome to the Police Roster Management System
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-10">
            <div className="spinner"></div>
            <p className="mt-2 text-gray-600">Loading dashboard data...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Personnel</dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">{summary.totalPolicemen}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link to="/policemen" className="font-medium text-indigo-600 hover:text-indigo-500">
                      View all personnel
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Field Officers</dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">{summary.fieldOfficers}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link to="/policemen" className="font-medium text-indigo-600 hover:text-indigo-500">
                      Manage field officers
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Drivers</dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">{summary.drivers}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link to="/policemen" className="font-medium text-indigo-600 hover:text-indigo-500">
                      Manage drivers
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Rosters</dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">{rosterSummary.activeRosters}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link to="/roster-generator" className="font-medium text-indigo-600 hover:text-indigo-500">
                      Manage rosters
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Roster insights section */}
            <div className="bg-white shadow rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Roster Insights
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Overview of current roster status and assignments.
                </p>
              </div>
              <div className="border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 p-6 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-base font-medium text-gray-700">Total Officers Assigned</h4>
                    <p className="mt-2 text-xl font-semibold text-blue-600">{rosterSummary.totalOfficersAssigned}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-base font-medium text-gray-700">Active Rosters</h4>
                    <p className="mt-2 text-xl font-semibold text-green-600">{rosterSummary.activeRosters}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-base font-medium text-gray-700">Pending Rosters</h4>
                    <p className="mt-2 text-xl font-semibold text-yellow-600">{rosterSummary.pendingRosters}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-base font-medium text-gray-700">Previous Rosters</h4>
                    <p className="mt-2 text-xl font-semibold text-gray-600">{rosterSummary.previousRosters}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Quick Actions
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Frequently used operations in the system.
                </p>
              </div>
              <div className="border-t border-gray-200">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 p-6">
                  <Link to="/policemen/new" className="block bg-indigo-50 text-indigo-700 p-4 rounded-lg hover:bg-indigo-100">
                    <h4 className="text-lg font-medium">Add New Personnel</h4>
                    <p className="text-sm mt-1">Add a new police officer to the system</p>
                  </Link>
                  <Link to="/zones/new" className="block bg-green-50 text-green-700 p-4 rounded-lg hover:bg-green-100">
                    <h4 className="text-lg font-medium">Create Zone</h4>
                    <p className="text-sm mt-1">Add a new zone to the system</p>
                  </Link>
                  <Link to="/zones" className="block bg-blue-50 text-blue-700 p-4 rounded-lg hover:bg-blue-100">
                    <h4 className="text-lg font-medium">Manage Zones</h4>
                    <p className="text-sm mt-1">View and manage zones and areas</p>
                  </Link>
                  <Link to="/roster-generator" className="block bg-purple-50 text-purple-700 p-4 rounded-lg hover:bg-purple-100">
                    <h4 className="text-lg font-medium">Generate Roster</h4>
                    <p className="text-sm mt-1">Create and manage duty rosters</p>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard; 