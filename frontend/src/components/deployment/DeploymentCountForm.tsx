import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAreaById, createDeployment } from '../../services/api';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface DeploymentCountFormProps {
  areaId: number;
}

interface DeploymentCounts {
  si_count: number;
  asi_count: number;
  hc_count: number;
  constable_count: number;
  driver_count: number;
  senior_count: number;
}

const DeploymentCountForm = ({ areaId }: DeploymentCountFormProps) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaName, setAreaName] = useState<string>('');
  
  const [formData, setFormData] = useState<DeploymentCounts>({
    si_count: 0,
    asi_count: 0,
    hc_count: 0,
    constable_count: 0,
    driver_count: 0,
    senior_count: 0
  });

  useEffect(() => {
    const fetchArea = async () => {
      try {
        const area = await getAreaById(areaId);
        setAreaName(area.name);
      } catch (err) {
        console.error('Error fetching area:', err);
        setError('Failed to load area data.');
      }
    };

    fetchArea();
  }, [areaId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value) || 0;
    
    setFormData(prev => ({
      ...prev,
      [name]: numValue >= 0 ? numValue : 0
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Create a deployment with the specified counts
      await createDeployment({
        area: areaId,
        ...formData,
        start_date: new Date().toISOString().split('T')[0],
        duty_type: 'STATIC' // Default type for count-based deployments
      });
      
      // Redirect back to area deployments page
      navigate(`/areas/${areaId}/deployments`);
    } catch (err) {
      console.error('Error saving deployment counts:', err);
      setError('Failed to save deployment counts. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
      <h2 className="text-xl font-semibold mb-2">Deployment Counts for {areaName}</h2>
      <p className="text-sm text-gray-500 mb-6">
        Specify the number of personnel required for each rank
      </p>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* SI Count */}
          <div>
            <label htmlFor="si_count" className="block text-sm font-medium text-gray-700">
              SI Count
            </label>
            <input
              type="number"
              min="0"
              id="si_count"
              name="si_count"
              value={formData.si_count}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          {/* ASI Count */}
          <div>
            <label htmlFor="asi_count" className="block text-sm font-medium text-gray-700">
              ASI Count
            </label>
            <input
              type="number"
              min="0"
              id="asi_count"
              name="asi_count"
              value={formData.asi_count}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          {/* HC Count */}
          <div>
            <label htmlFor="hc_count" className="block text-sm font-medium text-gray-700">
              HC Count
            </label>
            <input
              type="number"
              min="0"
              id="hc_count"
              name="hc_count"
              value={formData.hc_count}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          {/* Constable Count */}
          <div>
            <label htmlFor="constable_count" className="block text-sm font-medium text-gray-700">
              Constable Count
            </label>
            <input
              type="number"
              min="0"
              id="constable_count"
              name="constable_count"
              value={formData.constable_count}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          {/* Driver Count */}
          <div>
            <label htmlFor="driver_count" className="block text-sm font-medium text-gray-700">
              Driver Count
            </label>
            <input
              type="number"
              min="0"
              id="driver_count"
              name="driver_count"
              value={formData.driver_count}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          {/* Senior Count */}
          <div>
            <label htmlFor="senior_count" className="block text-sm font-medium text-gray-700">
              Senior Count
            </label>
            <input
              type="number"
              min="0"
              id="senior_count"
              name="senior_count"
              value={formData.senior_count}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
        
        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(`/areas/${areaId}/deployments`)}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {isSubmitting ? 'Saving...' : 'Save Deployment Counts'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DeploymentCountForm; 