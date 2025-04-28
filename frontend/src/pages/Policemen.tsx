import { useState, useEffect } from 'react';
import { Policeman, PolicemanFilters } from '../types';
import PolicemanList from '../components/policeman/PolicemanList';
import PolicemanFiltersComponent from '../components/policeman/PolicemanFilters';
import Layout from '../components/layout/Layout';
import { getPolicemen, deletePoliceman } from '../services/api';

const Policemen = () => {
  const [allPolicemen, setAllPolicemen] = useState<Policeman[]>([]);
  const [displayedPolicemen, setDisplayedPolicemen] = useState<Policeman[]>([]);
  const [filters, setFilters] = useState<PolicemanFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch policemen without gender filter
  useEffect(() => {
    fetchPolicemen();
  }, [filters.rank, filters.is_driver, filters.preferred_duty, filters.has_fixed_duty, filters.search]);

  // Apply gender filter locally
  useEffect(() => {
    if (allPolicemen.length > 0) {
      applyFilters();
    }
  }, [allPolicemen, filters.gender]);

  const fetchPolicemen = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Create a copy of filters without the gender property
      const apiFilters = { ...filters };
      delete apiFilters.gender;
      
      const data = await getPolicemen(apiFilters);
      setAllPolicemen(data);
      
      // Apply gender filter to the fetched data
      applyFilters(data);
    } catch (err) {
      setError('Failed to fetch policemen. Please try again later.');
      console.error('Error fetching policemen:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = (data?: Policeman[]) => {
    const policemanData = data || allPolicemen;
    
    // Apply gender filter locally
    let filteredData = [...policemanData];
    
    if (filters.gender) {
      console.log(`Filtering policemen by gender: ${filters.gender}`);
      filteredData = filteredData.filter(p => {
        const match = p.gender === filters.gender;
        console.log(`Policeman ${p.name} gender: ${p.gender}, matches filter: ${match}`);
        return match;
      });
    }
    
    setDisplayedPolicemen(filteredData);
  };

  const handleFilterChange = (newFilters: PolicemanFilters) => {
    console.log("New filters:", newFilters);
    setFilters(newFilters);
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePoliceman(id);
      // Update both data arrays
      const updatedAll = allPolicemen.filter(policeman => policeman.id !== id);
      setAllPolicemen(updatedAll);
      setDisplayedPolicemen(displayedPolicemen.filter(policeman => policeman.id !== id));
    } catch (err) {
      setError('Failed to delete policeman. Please try again later.');
      console.error('Error deleting policeman:', err);
    }
  };

  return (
    <Layout>
      <div className="pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Police Personnel Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add, edit, or remove police personnel and manage their details.
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

        <PolicemanFiltersComponent onFilterChange={handleFilterChange} />
        <PolicemanList 
          policemen={displayedPolicemen} 
          onDelete={handleDelete} 
          isLoading={isLoading} 
        />
      </div>
    </Layout>
  );
};

export default Policemen; 