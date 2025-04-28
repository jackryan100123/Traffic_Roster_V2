import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { getZones, deleteZone } from '../services/api';
import { Zone } from '../types';
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const Zones = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetchZones();
  }, [search]);

  const fetchZones = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getZones(search);
      setZones(data);
    } catch (err) {
      setError('Failed to fetch zones. Please try again later.');
      console.error('Error fetching zones:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (id: number) => {
    setDeleteConfirm(id);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteZone(id);
      setZones(zones.filter(zone => zone.id !== id));
    } catch (err) {
      setError('Failed to delete zone. Please try again later.');
      console.error('Error deleting zone:', err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  return (
    <Layout>
      <div className="pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Zones Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add, edit, or remove zones and manage their areas.
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

        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-full max-w-md">
              <label htmlFor="search" className="sr-only">Search zones</label>
              <div className="relative rounded-md shadow-sm">
                <input
                  type="text"
                  name="search"
                  id="search"
                  className="block w-full pr-10 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Search zones..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            <Link
              to="/zones/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Add New Zone
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10">
            <div className="spinner"></div>
            <p className="mt-2 text-gray-600">Loading zones data...</p>
          </div>
        ) : zones.length === 0 ? (
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
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No zones found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new zone.
              </p>
              <div className="mt-6">
                <Link
                  to="/zones/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Add New Zone
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {zones.map((zone) => (
                <li key={zone.id}>
                  <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-medium text-gray-900">{zone.name}</h3>
                      {zone.description && (
                        <p className="mt-1 text-sm text-gray-500">{zone.description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      <Link
                        to={`/zones/${zone.id}/areas`}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View Areas
                      </Link>
                      <Link
                        to={`/zones/edit/${zone.id}`}
                        className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-100 transition-colors group relative"
                        title="Edit"
                      >
                        <PencilSquareIcon className="h-5 w-5" />
                        <span className="absolute left-1/2 transform -translate-x-1/2 -bottom-8 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Edit Zone
                        </span>
                      </Link>
                      {deleteConfirm === zone.id ? (
                        <div className="flex items-center bg-red-50 border border-red-200 rounded-md px-2 py-1">
                          <span className="text-red-500 mr-2 text-xs font-semibold">Confirm delete?</span>
                          <button
                            onClick={() => handleDelete(zone.id)}
                            className="text-red-600 hover:text-red-900 font-medium text-xs bg-white rounded px-2 py-1 hover:bg-red-100"
                          >
                            Yes
                          </button>
                          <button
                            onClick={cancelDelete}
                            className="text-gray-600 hover:text-gray-900 font-medium text-xs ml-1 bg-white rounded px-2 py-1 hover:bg-gray-100"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => confirmDelete(zone.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-100 transition-colors group relative"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                          <span className="absolute left-1/2 transform -translate-x-1/2 -bottom-8 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Delete Zone
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Zones; 