import { useState } from 'react';
import { PolicemanFilters as Filters } from '../../types';

interface PolicemanFiltersProps {
  onFilterChange: (filters: Filters) => void;
}

const PolicemanFilters = ({ onFilterChange }: PolicemanFiltersProps) => {
  const [filters, setFilters] = useState<Filters>({
    rank: '',
    is_driver: undefined,
    preferred_duty: '',
    gender: '',
    has_fixed_duty: undefined,
    search: '',
  });

  const handleFilterChange = (field: keyof Filters, value: string | boolean | undefined) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Log gender selection for debugging
  const handleGenderChange = (value: string) => {
    console.log(`Gender selected: ${value}`);
    handleFilterChange('gender', value);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilterChange('search', e.target.value);
  };

  const clearFilters = () => {
    const emptyFilters: Filters = {
      rank: '',
      is_driver: undefined,
      preferred_duty: '',
      gender: '',
      has_fixed_duty: undefined,
      search: '',
    };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  // Helper to handle gender values in case they come back in different formats
  const isSelectedGender = (value: string): boolean => {
    const normalizedGender = filters.gender === 'M' ? 'Male' : 
                             filters.gender === 'F' ? 'Female' : 
                             filters.gender;
    return normalizedGender === value;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Filter Policemen</h3>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="text"
            name="search"
            id="search"
            placeholder="Search by name or belt number"
            className="block w-full pr-10 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={filters.search}
            onChange={handleSearch}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label htmlFor="rank" className="block text-sm font-medium text-gray-700">Rank</label>
          <select
            id="rank"
            name="rank"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={filters.rank}
            onChange={(e) => handleFilterChange('rank', e.target.value)}
          >
            <option value="">All Ranks</option>
            <option value="INSP">Inspector</option>
            <option value="SI">Sub Inspector</option>
            <option value="ASI">Assistant Sub Inspector</option>
            <option value="HC">Head Constable</option>
            <option value="CONST">Constable</option>
            <option value="HG">Home Guard</option>
          </select>
        </div>

        <div>
          <label htmlFor="preferred_duty" className="block text-sm font-medium text-gray-700">Preferred Duty</label>
          <select
            id="preferred_duty"
            name="preferred_duty"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={filters.preferred_duty}
            onChange={(e) => handleFilterChange('preferred_duty', e.target.value)}
          >
            <option value="">All Duties</option>
            <option value="STATIC">Static</option>
            <option value="FIELD">Field</option>
          </select>
        </div>

        <div>
          <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
          <select
            id="gender"
            name="gender"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={filters.gender}
            onChange={(e) => handleGenderChange(e.target.value)}
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center">
            <input
              id="is_driver"
              name="is_driver"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={filters.is_driver === true}
              onChange={(e) => handleFilterChange('is_driver', e.target.checked ? true : undefined)}
            />
            <label htmlFor="is_driver" className="ml-2 block text-sm text-gray-700">
              Is Driver
            </label>
          </div>
        </div>

        <div>
          <div className="flex items-center">
            <input
              id="has_fixed_duty"
              name="has_fixed_duty"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={filters.has_fixed_duty === true}
              onChange={(e) => handleFilterChange('has_fixed_duty', e.target.checked ? true : undefined)}
            />
            <label htmlFor="has_fixed_duty" className="ml-2 block text-sm text-gray-700">
              Has Fixed Duty
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={clearFilters}
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default PolicemanFilters; 