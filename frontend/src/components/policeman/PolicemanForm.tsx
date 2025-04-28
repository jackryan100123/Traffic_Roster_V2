import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Policeman, Area } from '../../types';
import { createPoliceman, updatePoliceman, getAreas } from '../../services/api';

interface PolicemanFormProps {
  initialData?: Partial<Policeman>;
  isEdit?: boolean;
}

const PolicemanForm = ({ initialData = {}, isEdit = false }: PolicemanFormProps) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [formData, setFormData] = useState<Partial<Policeman>>({
    name: '',
    belt_no: '',
    rank: 'CONST',
    gender: 'Male',
    is_driver: false,
    preferred_duty: 'FIELD',
    specialized_duty: '',
    has_fixed_duty: false,
    fixed_area: null,
    ...initialData
  });

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const areasData = await getAreas();
        setAreas(areasData);
      } catch (err) {
        console.error('Failed to fetch areas:', err);
      }
    };

    fetchAreas();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
      
      // If has_fixed_duty is unchecked, reset fixed_area
      if (name === 'has_fixed_duty' && !checked) {
        setFormData(prev => ({ ...prev, fixed_area: null }));
      }
    } else {
      let processedValue: string | number | null = value;
      
      // Convert fixed_area to number or null
      if (name === 'fixed_area') {
        processedValue = value ? parseInt(value, 10) : null;
      }
      
      setFormData(prev => ({ ...prev, [name]: processedValue }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit && initialData.id) {
        await updatePoliceman(initialData.id, formData);
      } else {
        await createPoliceman(formData as Omit<Policeman, 'id'>);
      }
      navigate('/policemen');
    } catch (err) {
      console.error('Error saving policeman:', err);
      setError('Failed to save policeman data. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium mb-6">{isEdit ? 'Edit Policeman' : 'Add New Policeman'}</h2>
      
      {error && (
        <div className="bg-red-50 p-4 rounded-md mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              required
              value={formData.name || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="belt_no" className="block text-sm font-medium text-gray-700">
              Belt Number
            </label>
            <input
              type="text"
              name="belt_no"
              id="belt_no"
              required
              value={formData.belt_no || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="rank" className="block text-sm font-medium text-gray-700">
              Rank
            </label>
            <select
              id="rank"
              name="rank"
              required
              value={formData.rank || 'CONST'}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="INSP">Inspector</option>
              <option value="SI">Sub Inspector</option>
              <option value="ASI">Assistant Sub Inspector</option>
              <option value="HC">Head Constable</option>
              <option value="CONST">Constable</option>
              <option value="HG">Home Guard</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              required
              value={formData.gender || 'Male'}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="preferred_duty" className="block text-sm font-medium text-gray-700">
              Preferred Duty
            </label>
            <select
              id="preferred_duty"
              name="preferred_duty"
              required
              value={formData.preferred_duty || 'FIELD'}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="FIELD">Field</option>
              <option value="STATIC">Static</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="specialized_duty" className="block text-sm font-medium text-gray-700">
              Specialized Duty (Optional)
            </label>
            <input
              type="text"
              name="specialized_duty"
              id="specialized_duty"
              value={formData.specialized_duty || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center">
              <input
                id="is_driver"
                name="is_driver"
                type="checkbox"
                checked={formData.is_driver || false}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="is_driver" className="ml-2 block text-sm text-gray-700">
                Is Driver
              </label>
            </div>
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center">
              <input
                id="has_fixed_duty"
                name="has_fixed_duty"
                type="checkbox"
                checked={formData.has_fixed_duty || false}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="has_fixed_duty" className="ml-2 block text-sm text-gray-700">
                Has Fixed Duty
              </label>
            </div>
          </div>
          
          {formData.has_fixed_duty && (
            <div className="col-span-1 md:col-span-2">
              <label htmlFor="fixed_area" className="block text-sm font-medium text-gray-700">
                Fixed Area
              </label>
              <select
                id="fixed_area"
                name="fixed_area"
                required={formData.has_fixed_duty}
                value={formData.fixed_area?.toString() || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select an area</option>
                {areas.map(area => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({area.zone_name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/policemen')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PolicemanForm; 